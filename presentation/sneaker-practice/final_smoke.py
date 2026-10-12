"""Final application HTTP acceptance. Run only on a disposable fresh seeded DB."""
import json
import os
from pathlib import Path
import subprocess
import sys
from sqlalchemy import select, text
from app.database import engine
from app.models import Base
from verify_m23 import server

ROOT=Path(__file__).resolve().parent
EXPECTED={
 'catalog': [('GET','/products'),('GET','/products/{product_id}'),('POST','/products'),('PUT','/products/{product_id}'),('DELETE','/products/{product_id}'),('GET','/brands')],
 'auth': [('POST','/auth/register'),('POST','/auth/login'),('GET','/auth/me')],
 'cart': [('GET','/cart'),('POST','/cart/items'),('PATCH','/cart/items/{item_id}'),('DELETE','/cart/items/{item_id}')],
 'orders': [('POST','/orders'),('GET','/orders'),('GET','/orders/{order_id}'),('PATCH','/orders/{order_id}/status')],
 'health': [('GET','/health')]
}

def verify():
    # An explicit marker prevents accidentally running this data-writing scenario
    # against the working database from an ordinary shell.
    if os.getenv('SNEAKER_FINAL_DISPOSABLE')!='yes':
        raise SystemExit('Run verify_final.py; this scenario requires its disposable database.')
    checks=[];errors=[];journey=[]
    def check(label,condition):
        assert condition,label
        checks.append(label)
    def snapshot():
        with engine.connect() as db:
            return {t:[tuple(row) for row in db.execute(select(Base.metadata.tables[t]).order_by(Base.metadata.tables[t].c.id))] for t in Base.metadata.tables}
    with engine.connect() as db:
        check('migration created seven application tables',len(Base.metadata.tables)==7 and all(db.scalar(text('SELECT to_regclass(:name)'),{'name':name}) for name in Base.metadata.tables))
        check('migration head is 0001',db.scalar(text('SELECT version_num FROM alembic_version'))=='0001')
        check('seed counts are 2/3/4',tuple(db.execute(text('SELECT (SELECT count(*) FROM brands),(SELECT count(*) FROM products),(SELECT count(*) FROM product_sizes)')).one())==(2,3,4))
    before=snapshot()
    subprocess.run([sys.executable,'-m','app.seed'],cwd=ROOT,check=True,capture_output=True,timeout=20)
    check('second seed leaves all data unchanged',snapshot()==before)
    with server('app.final_main:app',os.environ.copy()) as client:
        check('final health probes database',client.get('/health').json()=={'status':'ok'})
        check('docs HTML served',client.get('/docs').status_code==200)
        spec=client.get('/openapi.json').json()
        methods={'get','post','put','patch','delete'}
        actual={(method.upper(),path) for path,ops in spec['paths'].items() for method in ops if method in methods}
        expected={x for values in EXPECTED.values() for x in values}
        check('all 18 operations match API map',actual==expected)
        check('protected checkout advertises Bearer security',bool(spec['paths']['/orders']['post'].get('security')))
        def registration(person):
            credentials={'email':person+'@example.com','password':'Study-only-'+person+'!'}
            r=client.post('/auth/register',json=credentials)
            check(person+' register',r.status_code==201 and 'hashed_password' not in r.text)
            r=client.post('/auth/login',json=credentials)
            check(person+' login',r.status_code==200)
            return {'Authorization':'Bearer '+r.json()['access_token']}
        anya=registration('anya');boris=registration('boris');admin=registration('admin')
        subprocess.run([sys.executable,'-m','app.promote_admin','admin@example.com'],cwd=ROOT,check=True,capture_output=True,timeout=20)
        check('admin promotion works through documented CLI',client.get('/auth/me',headers=admin).json()['is_admin'] is True)
        check('current user from JWT',client.get('/auth/me',headers=anya).json()['email']=='anya@example.com')
        journey.append({'step':'Вход','status':200,'result':'Аня подтверждена через /auth/me'})
        check('brands and product list',len(client.get('/brands').json())==2 and len(client.get('/products').json())==3)
        p=client.get('/products/10');check('product detail price',p.status_code==200 and p.json()['price']=='7990.00')
        journey.append({'step':'Каталог','status':200,'result':'101: 7990.00 / stock 3; 201: 5990.00 / stock 5'})
        body={'name':'Review Pair','brand_id':1,'price':'8990.00','description':'Local final check','image_url':None}
        p=client.post('/products',headers=admin,json=body);check('admin create product',p.status_code==201);pid=p.json()['id']
        p=client.put(f'/products/{pid}',headers=admin,json={**body,'price':'8991.00'});check('admin update product',p.status_code==200 and p.json()['price']=='8991.00')
        check('admin delete unreferenced product',client.delete(f'/products/{pid}',headers=admin).status_code==204)
        p=client.post('/cart/items',headers=anya,json={'product_size_id':101,'quantity':1});check('add cart item',p.status_code==200);cid=p.json()['id']
        p=client.patch(f'/cart/items/{cid}',headers=anya,json={'quantity':2});check('set absolute cart quantity',p.status_code==200 and p.json()['quantity']==2)
        check('delete cart item',client.delete(f'/cart/items/{cid}',headers=anya).status_code==204)
        for size,qty in [(101,2),(201,1)]:
            check('add checkout position '+str(size),client.post('/cart/items',headers=anya,json={'product_size_id':size,'quantity':qty}).status_code==200)
        cart=client.get('/cart',headers=anya).json()
        check('two-position cart total',cart['estimated_total']=='21970.00' and len(cart['items'])==2)
        cid=cart['items'][0]['id']
        journey.append({'step':'Корзина','status':200,'result':'Две позиции, три пары, сумма 21970.00'})
        def rejection(key,method,path,headers,body,status):
            before=snapshot();r=client.request(method,path,headers=headers,json=body)
            check(key+' status and no writes',r.status_code==status and snapshot()==before)
            errors.append({'key':key,'status':r.status_code,'unchanged':True,'detail':r.json()['detail']})
        rejection('no_token','GET','/cart',{},None,401)
        rejection('not_admin','POST','/products',anya,body,403)
        rejection('foreign_cart','PATCH',f'/cart/items/{cid}',boris,{'quantity':1},404)
        rejection('quantity_zero','PATCH',f'/cart/items/{cid}',anya,{'quantity':0},422)
        rejection('negative_price','POST','/products',admin,{**body,'price':'-1'},422)
        rejection('empty_email','POST','/auth/register',{}, {'email':'','password':'Do-not-echo-this!'},422)
        check('validation response omits submitted secrets','Do-not-echo-this!' not in json.dumps(errors))
        # Change only this temporary DB after cart addition to model later stock loss.
        with engine.begin() as db:db.execute(text('UPDATE product_sizes SET stock=0 WHERE id=201'))
        rejection('short_second_item','POST','/orders',anya,{},409)
        with engine.begin() as db:db.execute(text('UPDATE product_sizes SET stock=5 WHERE id=201'))
        r=client.post('/orders',headers=anya,json={});check('checkout created',r.status_code==201);order=r.json();oid=order['id']
        check('checkout total and price snapshots',order['total']=='21970.00' and [i['price_at_purchase'] for i in order['items']]==['7990.00','5990.00'])
        check('checkout cleared own cart',client.get('/cart',headers=anya).json()['items']==[])
        with engine.connect() as db:check('checkout stock 1 and 4',dict(db.execute(text('SELECT id,stock FROM product_sizes WHERE id IN (101,201)')).all())=={101:1,201:4})
        journey.append({'step':'Заказ','status':201,'result':'21970.00; stock 1 и 4; корзина пуста'})
        check('own history and detail',client.get('/orders',headers=anya).json()[0]['id']==oid and client.get(f'/orders/{oid}',headers=anya).status_code==200)
        rejection('foreign_order','GET',f'/orders/{oid}',boris,None,404)
        rejection('status_forbidden','PATCH',f'/orders/{oid}/status',anya,{'status':'processing'},403)
        r=client.patch(f'/orders/{oid}/status',headers=admin,json={'status':'processing'});check('admin status operation',r.status_code==200 and r.json()['status']=='processing')
        journey.append({'step':'История','status':200,'result':'Свой заказ виден; чужой ID возвращает 404'})
    engine.dispose()
    report={'checks':checks,'operation_count':len(actual),'operations':{k:[{'method':m,'path':p} for m,p in v] for k,v in EXPECTED.items()},'errors':errors,'journey':journey,'total':'21970.00'}
    (ROOT/'final-smoke-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('Final app:',len(checks),'checks passed; 18 operations called over HTTP.')

if __name__=='__main__':verify()
