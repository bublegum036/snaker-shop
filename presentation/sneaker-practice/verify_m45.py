"""Real HTTP M4–M5; SQLAlchemy rollback hooks; observed PostgreSQL lock waits."""
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import secrets
import time
from uuid import uuid4
import httpx
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker
from app.core.config import database_url
from app.database import make_engine
from app.models import Base
from app.seed import seed
from app.services.orders import checkout
from verify_m23 import server

ROOT = Path(__file__).resolve().parent

def verify():
    name='m45_check_'+uuid4().hex
    application='m45_http_'+uuid4().hex
    url=make_url(database_url())
    admin=create_engine(url.set(database='postgres'),isolation_level='AUTOCOMMIT',connect_args={'connect_timeout':3})
    engine=None
    created=False
    checks=[]
    report={'ownership':{},'cart_errors':[], 'rollback':[], 'races':[]}
    def check(label, condition):
        assert condition, label
        checks.append(label)
    try:
        with admin.connect() as conn:
            conn.execute(text(f'CREATE DATABASE "{name}"'))
            created=True
        target=url.set(database=name)
        engine=make_engine(target)
        sessions=sessionmaker(engine)
        config=Config(str(ROOT/'alembic.ini'))
        with engine.begin() as conn:
            config.attributes['connection']=conn
            command.upgrade(config,'head')
        seed(engine)
        env=os.environ.copy()
        env.update(DATABASE_URL=target.update_query_dict({'application_name':application}).render_as_string(hide_password=False),JWT_SECRET=secrets.token_urlsafe(48))
        def snapshot():
            with engine.connect() as conn:
                return {t:[tuple(row) for row in conn.execute(select(Base.metadata.tables[t]).order_by(Base.metadata.tables[t].c.id))]
                    for t in ['products','product_sizes','cart_items','orders','order_items']}
        def reset():
            # Only this newly created disposable DB, never the configured working DB.
            with engine.begin() as conn:
                for table in ['order_items','orders','cart_items']:
                    conn.execute(text('DELETE FROM '+table))
                conn.execute(text('UPDATE product_sizes SET stock=CASE id WHEN 101 THEN 3 WHEN 102 THEN 0 WHEN 201 THEN 5 WHEN 301 THEN 2 END'))
                conn.execute(text('UPDATE products SET price=CASE id WHEN 10 THEN 7990 WHEN 20 THEN 5990 WHEN 30 THEN 9990 END'))
        with server('app.cart_main:app',env) as client:
            check('M4 cart route protected',client.get('/cart').status_code==401)
            check('M4 has no checkout routes',client.post('/orders').status_code==404)
        with server('app.checkout_main:app',env) as client:
            headers={}
            ids={}
            for person in ['anya','boris','admin']:
                credentials={'email':person+'@example.com','password':'Local-study-'+person+'!'}
                r=client.post('/auth/register',json=credentials)
                check(person+' registered',r.status_code==201)
                ids[person]=r.json()['id']
                token=client.post('/auth/login',json=credentials).json()['access_token']
                headers[person]={'Authorization':'Bearer '+token}
            with engine.begin() as conn:
                conn.execute(text('UPDATE users SET is_admin=true WHERE id=:id'),{'id':ids['admin']})
            def req(method,path,person='anya',body=None):
                return client.request(method,path,headers=headers[person],json=body)
            def add(size,qty=1,person='anya'):
                r=req('POST','/cart/items',person,{'product_size_id':size,'quantity':qty})
                assert r.status_code==200,(r.status_code,r.text)
                return r.json()
            for method,path,body in [('GET','/cart',None),('POST','/cart/items',{'product_size_id':101,'quantity':1}),('PATCH','/cart/items/1',{'quantity':1}),('DELETE','/cart/items/1',None),('POST','/orders',None),('GET','/orders',None),('GET','/orders/1',None),('PATCH','/orders/1/status',{'status':'processing'})]:
                r=client.request(method,path,json=body)
                check('unauthenticated '+method+' '+path,r.status_code==401)
            check('empty cart is normal',req('GET','/cart').json()=={'items':[],'estimated_total':'0.00'})
            before=snapshot()
            row=add(101)
            item_id=row['id']
            check('cart POST returns own size row',row['product_size_id']==101 and row['quantity']==1 and row['price']=='7990.00')
            row2=add(101)
            check('repeat add increments same item',row2['id']==item_id and row2['quantity']==2)
            check('cart subtotal and total computed from DB',req('GET','/cart').json()['estimated_total']=='15980.00')
            with engine.connect() as conn:
                check('cart is not a stock reservation',conn.scalar(text('SELECT stock FROM product_sizes WHERE id=101'))==3)
            check('second user initially sees empty cart',req('GET','/cart','boris').json()['items']==[])
            before=snapshot()
            for person in ['boris','admin']:
                statuses=[]
                for method,body in [('PATCH',{'quantity':1}),('DELETE',None)]:
                    r=req(method,'/cart/items/'+str(item_id),person,body)
                    statuses.append(r.status_code)
                    check(person+' cannot '+method+' foreign cart',r.status_code==404)
                check(person+' foreign actions preserve state',snapshot()==before)
                report['ownership'][person]={'patch':statuses[0],'delete':statuses[1],'unchanged':True}
            bad_cases=[('zero',{'product_size_id':101,'quantity':0},422),('negative',{'product_size_id':101,'quantity':-1},422),('boolean',{'product_size_id':101,'quantity':True},422),('owner_in_body',{'product_size_id':101,'quantity':1,'user_id':ids['boris']},422),('unknown_size',{'product_size_id':999,'quantity':1},404),('zero_stock',{'product_size_id':102,'quantity':1},409),('sum_exceeds_stock',{'product_size_id':101,'quantity':2},409)]
            for label,body,expected in bad_cases:
                r=req('POST','/cart/items',body=body)
                check('cart rejects '+label,r.status_code==expected and snapshot()==before)
                report['cart_errors'].append({'case':label,'status':expected,'unchanged':True})
            r=req('PATCH','/cart/items/'+str(item_id),body={'quantity':1})
            check('PATCH sets absolute quantity',r.status_code==200 and r.json()['quantity']==1)
            before=snapshot()
            for label,qty,expected in [('zero',0,422),('too_many',4,409)]:
                check('PATCH rejects '+label,req('PATCH','/cart/items/'+str(item_id),body={'quantity':qty}).status_code==expected and snapshot()==before)
            check('unknown cart item is 404',req('PATCH','/cart/items/2147483647',body={'quantity':1}).status_code==404)
            add(301,1,'boris')
            boris_before=req('GET','/cart','boris').json()
            r=req('DELETE','/cart/items/'+str(item_id))
            check('DELETE own item returns empty 204',r.status_code==204 and not r.content)
            check('repeat cart deletion is 404',req('DELETE','/cart/items/'+str(item_id)).status_code==404)
            check('deleting own item preserves other cart',req('GET','/cart','boris').json()==boris_before)
            before=snapshot()
            check('empty checkout is 409',req('POST','/orders').status_code==409 and snapshot()==before)
            add(101,2);add(201)
            before=snapshot()
            check('checkout rejects client totals and owner',req('POST','/orders',body={'total':'1.00','user_id':ids['boris']}).status_code==422 and snapshot()==before)
            r=req('POST','/orders')
            check('checkout returns 201',r.status_code==201)
            order=r.json();oid=order['id']
            check('checkout total owner status and snapshots',order['user_id']==ids['anya'] and order['total']=='21970.00' and order['status']=='created' and [i['price_at_purchase'] for i in order['items']]==['7990.00','5990.00'])
            check('own cart cleared after checkout',req('GET','/cart').json()['items']==[])
            check('checkout leaves other cart intact',req('GET','/cart','boris').json()==boris_before)
            with engine.connect() as conn:
                stock=dict(conn.execute(text('SELECT id,stock FROM product_sizes ORDER BY id')).all())
            check('checkout deducts both stocks once',stock=={101:1,102:0,201:4,301:2})
            report['success']={'total':order['total'],'status':order['status'],'positions':len(order['items']),'stocks':stock,'own_cart_rows':0,'other_cart_preserved':True}
            check('own order detail and history visible',req('GET',f'/orders/{oid}').status_code==200 and [o['id'] for o in req('GET','/orders').json()]==[oid])
            for person in ['boris','admin']:
                check(person+' cannot read foreign order detail',req('GET',f'/orders/{oid}',person).status_code==404)
                check(person+' history excludes foreign order',req('GET','/orders',person).json()==[])
            check('unknown order returns 404',req('GET','/orders/2147483647').status_code==404)
            check('history validates pagination',req('GET','/orders?limit=0').status_code==422)
            before=snapshot()
            for person in ['anya','boris']:
                check(person+' cannot change order status',req('PATCH',f'/orders/{oid}/status',person,{'status':'processing'}).status_code==403 and snapshot()==before)
            check('unknown status is 422',req('PATCH',f'/orders/{oid}/status','admin',{'status':'cancelled'}).status_code==422)
            check('skipped transition is 409',req('PATCH',f'/orders/{oid}/status','admin',{'status':'completed'}).status_code==409)
            for status in ['processing','processing','completed']:
                r=req('PATCH',f'/orders/{oid}/status','admin',{'status':status})
                check('admin status '+status,r.status_code==200 and r.json()['status']==status)
            check('backward transition is 409',req('PATCH',f'/orders/{oid}/status','admin',{'status':'created'}).status_code==409)
            after=snapshot()
            check('status changes never alter stock or positions',before['product_sizes']==after['product_sizes'] and before['order_items']==after['order_items'] and before['cart_items']==after['cart_items'])
            check('admin unknown order status is 404',req('PATCH','/orders/2147483647/status','admin',{'status':'processing'}).status_code==404)
            with engine.begin() as conn:conn.execute(text('UPDATE products SET price=8990 WHERE id=10'))
            historic=req('GET',f'/orders/{oid}').json()
            check('history keeps old prices after catalog edit',historic['total']=='21970.00' and historic['items'][0]['price_at_purchase']=='7990.00')
            before=snapshot()
            check('repeated checkout sees empty cart not duplicate',req('POST','/orders').status_code==409 and snapshot()==before)
            reset();add(101,2);add(201)
            with engine.begin() as conn:conn.execute(text('UPDATE product_sizes SET stock=0 WHERE id=201'))
            before=snapshot()
            r=req('POST','/orders')
            check('short second position rejects whole order',r.status_code==409 and snapshot()==before)
            report['shortage']={'status':409,'all_rows_unchanged':True,'cart_rows':2}
            reset();add(101,2);add(201)
            for fault in ['after_order','after_first_stock','after_cart_delete']:
                before=snapshot()
                def inject(stage,db):
                    if stage==fault:raise RuntimeError('Injected test failure')
                try:checkout(ids['anya'],sessions=sessions,_test_hook=inject)
                except RuntimeError as error:assert str(error)=='Injected test failure'
                else:raise AssertionError('Fault was not triggered')
                check('ORM rollback '+fault,snapshot()==before)
                report['rollback'].append({'stage':fault,'restored':True,'orders':0,'cart_rows':2,'stock101':3,'stock201':5})
            check('fault hook is not an HTTP option',req('POST','/orders',body={'_test_hook':'after_order'}).status_code==422)
            base=str(client.base_url)
            def concurrent(method,path,person,body=None):
                with httpx.Client(base_url=base,timeout=15,trust_env=False) as other:
                    return other.request(method,path,headers=headers[person],json=body)
            def wait_for_locks(conn,minimum):
                deadline=time.monotonic()+2
                while True:
                    conn.execute(text('SELECT pg_stat_clear_snapshot()'))
                    waiting=conn.execute(text("SELECT pid, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE application_name=:app AND wait_event_type='Lock'"),{'app':application}).all()
                    if len(waiting)>=minimum and all(row.blockers for row in waiting):return len(waiting)
                    if time.monotonic()>=deadline:raise AssertionError('Did not observe expected PostgreSQL lock waits')
                    time.sleep(.01)
            # Hold one database row until actual HTTP workers are observed waiting.
            reset()
            with engine.begin() as conn:conn.execute(text('UPDATE product_sizes SET stock=1 WHERE id=101'))
            add(101,person='anya');add(101,person='boris')
            with ThreadPoolExecutor(max_workers=2) as pool:
                with engine.begin() as gate:
                    gate.execute(text('SELECT id FROM product_sizes WHERE id=101 FOR UPDATE'))
                    futures=[pool.submit(concurrent,'POST','/orders',person) for person in ['anya','boris']]
                    observed=wait_for_locks(gate,2)
                responses=[f.result() for f in futures]
            codes=sorted(r.status_code for r in responses)
            check('two HTTP buyers of last pair get 201 and 409',codes==[201,409])
            with engine.connect() as conn:
                counts=conn.execute(text('SELECT (SELECT count(*) FROM orders), (SELECT stock FROM product_sizes WHERE id=101), (SELECT count(*) FROM cart_items)')).one()
            check('last pair creates one order and preserves losing cart',tuple(counts)==(1,0,1))
            report['races'].append({'case':'last_pair','statuses':codes,'observed_waits':observed,'orders':1,'stock':0,'remaining_cart_rows':1})
            reset();add(101)
            with ThreadPoolExecutor(max_workers=2) as pool:
                with engine.begin() as gate:
                    gate.execute(text('SELECT id FROM users WHERE id=:id FOR UPDATE'),{'id':ids['anya']})
                    futures=[pool.submit(concurrent,'POST','/orders','anya') for _ in range(2)]
                    observed=wait_for_locks(gate,2)
                responses=[f.result() for f in futures]
            check('two checkouts of same cart create one order',sorted(r.status_code for r in responses)==[201,409] and req('GET','/cart').json()['items']==[])
            with engine.connect() as conn:check('same-user order count is one',conn.scalar(text('SELECT count(*) FROM orders'))==1)
            report['races'].append({'case':'same_user','statuses':[201,409],'observed_waits':observed,'orders':1,'remaining_cart_rows':0})
            reset();add(101)
            with ThreadPoolExecutor(max_workers=2) as pool:
                with engine.begin() as gate:
                    gate.execute(text('SELECT id FROM product_sizes WHERE id=101 FOR UPDATE'))
                    buying=pool.submit(concurrent,'POST','/orders','anya')
                    wait_for_locks(gate,1)
                    adding=pool.submit(concurrent,'POST','/cart/items','anya',{'product_size_id':301,'quantity':1})
                    observed=wait_for_locks(gate,2)
                purchase,addition=buying.result(),adding.result()
            cart=req('GET','/cart').json()
            check('cart edit waits and remains after checkout',purchase.status_code==201 and addition.status_code==200 and len(cart['items'])==1 and cart['items'][0]['product_size_id']==301)
            report['races'].append({'case':'cart_write','statuses':[201,200],'observed_waits':observed,'new_cart_size':301,'remaining_cart_rows':1})
            # The timeout response also has to leave the cart and stock unchanged.
            reset();add(101)
            before=snapshot()
            with engine.begin() as gate:
                gate.execute(text('SELECT id FROM product_sizes WHERE id=101 FOR UPDATE'))
                r=req('POST','/orders')
            check('lock timeout maps to controlled 409 and rollback',r.status_code==409 and r.json()['detail']=='concurrent_change_retry' and snapshot()==before)
            report['timeout']={'status':409,'unchanged':True}
        report.update(checks=checks,database='new disposable database',isolation='READ COMMITTED',rollback_transport='direct calls to the same ORM service',race_transport='real HTTP and observed database lock waits')
    finally:
        if engine is not None:engine.dispose()
        if created:
            with admin.connect() as conn:conn.execute(text(f'DROP DATABASE "{name}"'))
        admin.dispose()
    serialized=json.dumps(report,ensure_ascii=False,indent=2)
    (ROOT/'m45-verification.json').write_text(serialized+'\n')
    (ROOT/'m45-verified.js').write_text('window.SNEAKER_M45 = '+serialized+';\n')
    print(f'Verified {len(checks)} M4–M5 checks; HTTP races and ORM rollback passed; temporary DB removed.')

if __name__=='__main__':verify()
