"""M2–M3 acceptance: real Uvicorn, real JWT and a disposable PostgreSQL DB."""
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import time
from uuid import uuid4
import httpx
from jose import jwt
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url
from alembic import command
from alembic.config import Config
from app.core.config import database_url
from app.core.security import create_token, verify_password, hash_password, ISSUER, AUDIENCE
from app.database import make_engine
from app.models import Base
from app.seed import seed

ROOT = Path(__file__).resolve().parent

@contextmanager
def server(module, env):
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    process = subprocess.Popen([sys.executable,'-m','uvicorn',module,'--host','127.0.0.1','--port',str(port)],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        with httpx.Client(base_url=f'http://127.0.0.1:{port}',timeout=15,trust_env=False) as client:
            deadline = time.monotonic()+15
            while True:
                try:
                    if client.get('/health').status_code == 200:
                        break
                except httpx.ConnectError:
                    pass
                if time.monotonic() > deadline or process.poll() is not None:
                    raise RuntimeError(f'{module} did not become ready')
                time.sleep(.1)
            yield client
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill(); process.wait()

def verify():
    name='m23_check_'+uuid4().hex
    url=make_url(database_url())
    admin=create_engine(url.set(database='postgres'),isolation_level='AUTOCOMMIT',connect_args={'connect_timeout':3})
    engine=None
    created=False
    checks=[]
    report={'filters':[], 'matrix':[], 'auth':{}, 'deletion':{}}
    def check(label, ok):
        assert ok, label
        checks.append(label)
    try:
        with admin.connect() as connection:
            connection.execute(text(f'CREATE DATABASE "{name}"'))
            created=True
        target=url.set(database=name)
        engine=make_engine(target)
        config=Config(str(ROOT/'alembic.ini'))
        with engine.begin() as connection:
            config.attributes['connection']=connection
            command.upgrade(config,'head')
        seed(engine)
        env=os.environ.copy()
        secret=secrets.token_urlsafe(48)
        env.update(DATABASE_URL=target.render_as_string(hide_password=False),JWT_SECRET=secret)
        def snapshot():
            with engine.connect() as connection:
                return {t:[tuple(r) for r in connection.execute(select(Base.metadata.tables[t]).order_by(Base.metadata.tables[t].c.id))] for t in ['products','product_sizes','cart_items','orders','order_items']}
        initial=snapshot()
        body={'name':'Practice Pair','brand_id':1,'price':'8990.00','description':'Lesson card','image_url':None}
        with server('app.catalog_main:app',env) as client:
            check('M2 public catalog available',client.get('/products').status_code==200)
            for method,path in [('POST','/products'),('PUT','/products/10'),('DELETE','/products/10')]:
                response=client.request(method,path,json=body if method!='DELETE' else None)
                check(f'M2 {method} route unavailable',response.status_code==405)
            check('M2 writes absent in OpenAPI',set(client.get('/openapi.json').json()['paths']['/products'])=={'get'})
            check('M2 forbidden writes preserve data',snapshot()==initial)
        with server('app.store_main:app',env) as client:
            check('M3 Swagger HTML available',client.get('/docs').status_code==200)
            schema=client.get('/openapi.json').json()
            check('OpenAPI defines HTTP Bearer for writes',schema['components']['securitySchemes']['HTTPBearer']['scheme']=='bearer' and schema['paths']['/products']['post']['security']==[{'HTTPBearer':[]}])
            check('public brands available', [x['name'] for x in client.get('/brands').json()]==['North','City'])
            r=client.get('/products/10')
            check('card contains Decimal price and both sizes',r.status_code==200 and r.json()['price']=='7990.00' and len(r.json()['sizes'])==2)
            filter_cases=[
                ('all','/products',[10,20,30]),
                ('brand','/products?brand_id=1',[10,30]),
                ('price','/products?min_price=6000&max_price=8000',[10]),
                ('size','/products?size=42',[10,30]),
                ('sold_out','/products?size=43',[]),
                ('search','/products?search=nOrTh',[10,30]),
                ('combined','/products?brand_id=1&size=42&max_price=8000',[10]),
                ('empty','/products?brand_id=999',[]),
                ('literal','/products?search=%25',[]),
                ('page1','/products?limit=1&offset=0',[10]),
                ('page2','/products?limit=1&offset=1',[20]),
                ('beyond','/products?limit=1&offset=99',[]),
            ]
            for key,path,ids in filter_cases:
                r=client.get(path)
                check('catalog '+key,r.status_code==200 and [x['id'] for x in r.json()]==ids)
                report['filters'].append({'key':key,'request':path,'status':r.status_code,'ids':ids})
            for query in ['limit=0','limit=101','offset=-1','min_price=9000&max_price=1000','size=-1','min_price=NaN']:
                check('invalid query '+query,client.get('/products?'+query).status_code==422)
            check('unknown product returns 404',client.get('/products/999').status_code==404)
            password='Local-study-A7!'
            credentials={'email':'anya@example.com','password':password}
            r=client.post('/auth/register',json=credentials)
            check('register ordinary user',r.status_code==201 and not r.json()['is_admin'])
            uid=r.json()['id']
            check('register response omits password and hash',set(r.json())=={'id','email','is_admin'})
            check('duplicate normalized email returns 409',client.post('/auth/register',json={**credentials,'email':'ANYA@example.com'}).status_code==409)
            check('public privilege injection rejected',client.post('/auth/register',json={**credentials,'email':'other@example.com','is_admin':True}).status_code==422)
            for bad in [{'email':'bad','password':password},{'email':'short@example.com','password':'123'},{'email':'long@example.com','password':'я'*37}]:
                r=client.post('/auth/register',json=bad)
                check('invalid credentials '+bad['email'],r.status_code==422 and 'input' not in r.text and bad['password'] not in r.text)
            with engine.connect() as connection:
                stored=connection.scalar(text('SELECT hashed_password FROM users WHERE id=:id'),{'id':uid})
                check('password stored as verified bcrypt hash',stored!=password and stored.startswith('$2b$') and verify_password(password,stored))
                check('failed registration created no extra account',connection.scalar(text('SELECT count(*) FROM users'))==1)
            check('wrong password does not verify',not verify_password('Wrong-password!',stored))
            check('same password gets different salted hashes',hash_password(password)!=stored)
            r=client.post('/auth/login',json=credentials)
            check('JSON login issues bearer token',r.status_code==200 and r.json()['token_type']=='bearer')
            token=r.json()['access_token']
            user_headers={'Authorization':'Bearer '+token}
            claims=jwt.decode(token,secret,algorithms=['HS256'],issuer=ISSUER,audience=AUDIENCE)
            check('JWT contains subject expiry issuer audience without role/password',claims['sub']==str(uid) and all(k in claims for k in ['exp','iss','aud']) and 'is_admin' not in claims and 'password' not in claims)
            missing=client.post('/auth/login',json={'email':'missing@example.com','password':password})
            wrong=client.post('/auth/login',json={**credentials,'password':'Wrong-password!'})
            check('unknown user and wrong password have same 401',missing.status_code==wrong.status_code==401 and missing.json()==wrong.json())
            r=client.get('/auth/me',headers=user_headers)
            check('me returns verified account without hash',r.status_code==200 and r.json()=={'id':uid,'email':'anya@example.com','is_admin':False})
            expired=create_token(uid,secret,datetime.now(timezone.utc)-timedelta(minutes=1))
            foreign=create_token(uid,secrets.token_urlsafe(48))
            nonexistent=create_token(2147483647,secret)
            bad_aud=jwt.encode({**claims,'aud':'other'},secret,algorithm='HS256')
            no_exp=jwt.encode({k:v for k,v in claims.items() if k!='exp'},secret,algorithm='HS256')
            wrong_alg=jwt.encode(claims,secret,algorithm='HS384')
            bad_sub=jwt.encode({**claims,'sub':'not-a-number'},secret,algorithm='HS256')
            for label,value in [('missing',None),('malformed','not-a-jwt'),('expired',expired),('signature',foreign),('absent_user',nonexistent),('audience',bad_aud),('no_exp',no_exp),('wrong_algorithm',wrong_alg),('invalid_subject',bad_sub)]:
                r=client.get('/auth/me',headers={} if value is None else {'Authorization':'Bearer '+value})
                check('me rejects '+label,r.status_code==401 and r.headers.get('www-authenticate')=='Bearer')
            admin_credentials={'email':'admin@example.com','password':'Local-study-admin!'}
            r=client.post('/auth/register',json=admin_credentials)
            admin_id=r.json()['id']
            r=client.post('/auth/login',json=admin_credentials)
            admin_token=r.json()['access_token']
            admin_headers={'Authorization':'Bearer '+admin_token}
            subprocess.run([sys.executable,'-m','app.promote_admin','admin@example.com'],cwd=ROOT,env=env,check=True,stdout=subprocess.DEVNULL)
            check('local promotion reflected with same existing token',client.get('/auth/me',headers=admin_headers).json()['is_admin'] is True)
            for label,headers,expected in [('none',{},401),('invalid',{'Authorization':'Bearer not-a-jwt'},401),('user',user_headers,403)]:
                before=snapshot()
                statuses=[]
                for method,path in [('POST','/products'),('PUT','/products/10'),('DELETE','/products/10')]:
                    r=client.request(method,path,headers=headers,json=body if method!='DELETE' else None)
                    statuses.append(r.status_code)
                    check(label+' denied '+method,r.status_code==expected)
                check(label+' denial preserves all catalog/cart/order rows',snapshot()==before)
                report['matrix'].append({'identity':label,'statuses':statuses,'unchanged':True})
            before=snapshot()
            for patch in [{'price':'-1'},{'price':'1.001'},{'name':'   '},{'brand_id':0},{'is_admin':True},{'image_url':'javascript:bad'}]:
                r=client.post('/products',json={**body,**patch},headers=admin_headers)
                check('reject product '+str(next(iter(patch))),r.status_code==422)
            check('invalid product inputs preserve database',snapshot()==before)
            r=client.post('/products',json={**body,'brand_id':999},headers=admin_headers)
            check('unknown brand returns 409 without insertion',r.status_code==409 and snapshot()==before)
            r=client.post('/products',json=body,headers=admin_headers)
            pid=r.json()['id']
            check('admin creates product with 201',r.status_code==201 and pid>30 and r.json()['price']=='8990.00')
            r=client.put('/products/'+str(pid),json={**body,'version':client.get('/products/'+str(pid)).json()['version'],'name':'Updated Pair','price':'9090.00'},headers=admin_headers)
            check('admin replaces card with 200',r.status_code==200 and r.json()['price']=='9090.00' and client.get('/products/'+str(pid)).json()['name']=='Updated Pair')
            r=client.delete('/products/'+str(pid),headers=admin_headers)
            check('admin deletes with empty 204',r.status_code==204 and not r.content and client.get('/products/'+str(pid)).status_code==404)
            report['matrix'].append({'identity':'admin','statuses':[201,200,204],'changed':True})
            for method in ['PUT','DELETE']:
                r=client.request(method,'/products/999',headers=admin_headers,json={**body,'version':1} if method=='PUT' else None)
                check('unknown product '+method+' returns 404',r.status_code==404)
            # Isolated historical fixture to prove delete preserves references.
            with engine.begin() as connection:
                connection.execute(text("INSERT INTO orders(id,user_id,total) VALUES(501,:uid,7990)"),{'uid':uid})
                connection.execute(text('INSERT INTO order_items(order_id,product_size_id,quantity,price_at_purchase) VALUES(501,101,1,7990)'))
            before=snapshot()
            r=client.delete('/products/10',headers=admin_headers)
            check('deleting historical product returns 409 and preserves whole state',r.status_code==409 and snapshot()==before)
            report['deletion']={'status':409,'product_id':10,'history_preserved':True}
            r=client.put('/products/10',json={**body,'version':client.get('/products/10').json()['version'],'name':'North Runner','price':'8990.00'},headers=admin_headers)
            with engine.connect() as connection:
                price=str(connection.scalar(text('SELECT price_at_purchase FROM order_items WHERE order_id=501')))
            check('catalog edit preserves historical price',r.status_code==200 and price=='7990.00')
            with engine.begin() as connection:
                connection.execute(text('INSERT INTO cart_items(user_id,product_size_id,quantity) VALUES(:uid,301,1)'),{'uid':uid})
            before=snapshot()
            r=client.delete('/products/30',headers=admin_headers)
            check('cart-only reference blocks deletion without changes',r.status_code==409 and snapshot()==before)
            with engine.begin() as connection:
                connection.execute(text('DELETE FROM cart_items WHERE user_id=:uid AND product_size_id=301'),{'uid':uid})
            r=client.delete('/products/30',headers=admin_headers)
            check('unreferenced product and sizes delete together',r.status_code==204)
            with engine.connect() as connection:
                check('deleted product sizes absent',connection.scalar(text('SELECT count(*) FROM product_sizes WHERE product_id=30'))==0)
            with engine.begin() as connection:
                connection.execute(text('UPDATE users SET is_admin=false WHERE id=:id'),{'id':admin_id})
            check('revoked role takes effect with same JWT',client.post('/products',json=body,headers=admin_headers).status_code==403)
            report['auth']={'register':201,'login':200,'me':200,'invalid':401,'ordinary_write':403,'hash_verified':True,'hash_hidden':True,'role_from_database':True}
        report['checks']=checks
        report['database']='new disposable database; real HTTP on loopback'
    finally:
        if engine is not None: engine.dispose()
        if created:
            with admin.connect() as connection:connection.execute(text(f'DROP DATABASE "{name}"'))
        admin.dispose()
    serialized=json.dumps(report,ensure_ascii=False,indent=2)
    (ROOT/'m23-verification.json').write_text(serialized+'\n')
    (ROOT/'m23-verified.js').write_text('window.SNEAKER_M23 = '+serialized+';\n')
    print(f'Verified {len(checks)} M2–M3 checks over real HTTP; temporary database removed.')

if __name__=='__main__':verify()
