"""Repeatable PostgreSQL experiments: rollback, overselling and row-lock protocols."""
import json
import os
import re
import time
from contextlib import contextmanager
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from pathlib import Path
from threading import Barrier, Event
from uuid import uuid4
import psycopg
from psycopg import sql
from psycopg.rows import dict_row
from checkout import checkout, add_cart_item, CheckoutRejected

ROOT=Path(__file__).resolve().parent
# Same fictitious local role as chapter 5. Override without printing real secrets.
URL=os.getenv('CHECKOUT_DATABASE_URL','postgresql://lesson:lesson-only@127.0.0.1:55432/sneaker_lesson')
DDL=(ROOT.parent/'sneaker-db-examples/sql/schema.sql').read_text()
SEED=(ROOT.parent/'sneaker-db-examples/sql/seed.sql').read_text()
result={'isolation':'READ COMMITTED','checks':[],'scenarios':{}}

def check(name, condition):
    assert condition,name
    result['checks'].append(name)

def connect(schema):
    assert re.fullmatch(r'lesson910_[a-z0-9_]+',schema)
    return psycopg.connect(URL,autocommit=True,row_factory=dict_row,connect_timeout=5,options=f'-c search_path={schema} -c default_transaction_isolation=read\\ committed')

@contextmanager
def fixture():
    schema='lesson910_'+uuid4().hex
    with psycopg.connect(URL,autocommit=True) as admin:
        admin.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(schema)))
    try:
        with connect(schema) as conn:
            conn.execute(DDL)
            conn.execute(SEED)
        yield schema
    finally:
        with psycopg.connect(URL,autocommit=True) as admin:
            admin.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(schema)))

def snapshot(schema):
    with connect(schema) as conn:
        return {
            'sizes':conn.execute('SELECT id,stock FROM product_sizes ORDER BY id').fetchall(),
            'cart':conn.execute('SELECT id,user_id,product_size_id,quantity FROM cart_items ORDER BY id').fetchall(),
            'orders':conn.execute('SELECT id,user_id,status,total FROM orders ORDER BY id').fetchall(),
            'items':conn.execute('SELECT id,order_id,product_size_id,quantity,price_at_purchase FROM order_items ORDER BY id').fetchall(),
        }

def setup_last_pair(schema, same_user=False):
    with connect(schema) as conn, conn.transaction():
        conn.execute('DELETE FROM cart_items')
        conn.execute('UPDATE product_sizes SET stock=1 WHERE id=101')
        conn.execute('INSERT INTO cart_items(user_id,product_size_id,quantity) VALUES(7,101,1)')
        if not same_user:
            conn.execute('INSERT INTO cart_items(user_id,product_size_id,quantity) VALUES(8,101,1)')

def outcome(fn):
    try:
        return {'outcome':'committed',**fn()}
    except CheckoutRejected as error:
        return {'outcome':'rejected','reason':str(error)}

with fixture() as schema:
    before=snapshot(schema)
    with connect(schema) as conn:
        saved=checkout(conn,7)
    after=snapshot(schema)
    check('successful checkout total and owner',saved['total']=='21970.00' and saved['user_id']==7)
    check('both stock values updated',dict((row['id'],row['stock']) for row in after['sizes'])=={101:1,102:0,201:4,301:2})
    check('only current cart cleared',len(after['cart'])==1 and after['cart'][0]['user_id']==8)
    check('one new order and two new lines',len(after['orders'])==len(before['orders'])+1 and len(after['items'])==len(before['items'])+2)
    result['scenarios']['success']={'before':before,'after':after,'order':saved}
    with connect(schema) as conn:
        conn.execute('UPDATE products SET price=8990 WHERE id=10')
        prices=conn.execute('SELECT price_at_purchase FROM order_items WHERE order_id=%s ORDER BY product_size_id',(saved['order_id'],)).fetchall()
        total=conn.execute('SELECT total FROM orders WHERE id=%s',(saved['order_id'],)).fetchone()['total']
    check('purchase prices and total stay after catalog change',prices[0]['price_at_purchase']==Decimal('7990.00') and total==Decimal('21970.00'))
    result['scenarios']['price_snapshot']={'catalog_price':'8990.00','price_at_purchase':str(prices[0]['price_at_purchase']),'total':str(total)}

result['scenarios']['rollback']={}
for point in ['after_order','after_first_stock','after_cart_delete']:
    with fixture() as schema:
        before=snapshot(schema)
        try:
            with connect(schema) as conn:
                checkout(conn,7,fail_at=point)
        except RuntimeError:
            pass
        else:
            raise AssertionError('Fault was not injected')
        after=snapshot(schema)
        check('complete rollback at '+point,before==after)
        result['scenarios']['rollback'][point]={'restored':before==after,'new_orders':len(after['orders'])-len(before['orders']),'cart_rows_user7':sum(x['user_id']==7 for x in after['cart'])}

for name,prepare,expected in [
    ('empty',lambda c:c.execute('DELETE FROM cart_items WHERE user_id=7'),'empty_cart'),
    ('zero_stock',lambda c:c.execute('UPDATE product_sizes SET stock=0 WHERE id=101'),'insufficient_stock'),
    ('too_many',lambda c:c.execute('UPDATE cart_items SET quantity=4 WHERE id=55'),'insufficient_stock'),
    ('second_item_short',lambda c:c.execute('UPDATE product_sizes SET stock=0 WHERE id=201'),'insufficient_stock'),
]:
    with fixture() as schema:
        with connect(schema) as conn:
            prepare(conn)
        before=snapshot(schema)
        with connect(schema) as conn:
            saved=outcome(lambda:checkout(conn,7))
        check('reject without changes: '+name,saved.get('reason')==expected and snapshot(schema)==before)
        result['scenarios'][name]=saved

# Intentionally wrong algorithm: both read 1, later each writes the stale value 0.
with fixture() as schema:
    setup_last_pair(schema)
    gate=Barrier(2)
    def unsafe(user_id):
        with connect(schema) as conn, conn.transaction():
            conn.execute("SET LOCAL statement_timeout='8s'")
            stock=conn.execute('SELECT stock FROM product_sizes WHERE id=101').fetchone()['stock']
            gate.wait(timeout=5)
            assert stock==1
            conn.execute('UPDATE product_sizes SET stock=%s WHERE id=101',(stock-1,))
            oid=conn.execute("INSERT INTO orders(user_id,status,total) VALUES(%s,'created',7990) RETURNING id",(user_id,)).fetchone()['id']
            conn.execute('INSERT INTO order_items(order_id,product_size_id,quantity,price_at_purchase) VALUES(%s,101,1,7990)',(oid,))
            conn.execute('DELETE FROM cart_items WHERE user_id=%s',(user_id,))
        return {'user_id':user_id,'read_stock':stock,'outcome':'committed'}
    with ThreadPoolExecutor(max_workers=2) as pool:
        answers=list(pool.map(unsafe,[7,8]))
    state=snapshot(schema)
    check('unsafe stale write oversells while stock remains zero',len(state['orders'])==3 and state['sizes'][0]['stock']==0)
    result['scenarios']['unsafe_race']={'workers':answers,'new_orders':2,'pairs_sold':2,'initial_stock':1,'final_stock':0}

# Three connections: two workers and an observer proving a real blocked session.
def run_locked_pair(schema, kind):
    held,release,second_started=Event(),Event(),Event()
    pids={}
    def hold(conn):
        pids['first']=conn.info.backend_pid
        held.set()
        if not release.wait(timeout=5):
            raise TimeoutError('Test failed to release first transaction')
    def first():
        with connect(schema) as conn:
            return outcome(lambda:checkout(conn,7,after_lock=hold))
    def second():
        with connect(schema) as conn:
            pids['second']=conn.info.backend_pid
            second_started.set()
            return outcome(lambda:add_cart_item(conn,7,301,1) if kind=='cart_write' else checkout(conn,7 if kind=='same_user' else 8))
    with ThreadPoolExecutor(max_workers=2) as pool:
        a=pool.submit(first)
        b=None
        try:
            assert held.wait(timeout=5)
            b=pool.submit(second)
            assert second_started.wait(timeout=5)
            blocked=False
            with connect(schema) as observer:
                deadline=time.monotonic()+4
                while time.monotonic()<deadline:
                    blockers=observer.execute('SELECT pg_blocking_pids(%s) AS pids',(pids['second'],)).fetchone()['pids']
                    if pids['first'] in blockers:
                        blocked=True
                        break
                    time.sleep(.02)
            check('real lock wait observed: '+kind,blocked)
        finally:
            release.set()
        return a.result(timeout=8),b.result(timeout=8)

for kind in ['last_pair','same_user','cart_write']:
    with fixture() as schema:
        setup_last_pair(schema,same_user=kind!='last_pair')
        a,b=run_locked_pair(schema,kind)
        state=snapshot(schema)
        check('single new order: '+kind,len(state['orders'])==2 and state['sizes'][0]['stock']==0)
        if kind=='last_pair':
            check('waiting buyer rechecks zero stock',a['outcome']=='committed' and b.get('reason')=='insufficient_stock' and state['cart'][0]['user_id']==8)
        elif kind=='same_user':
            check('second checkout sees cleared cart',b.get('reason')=='empty_cart' and not state['cart'])
        else:
            check('cart change after checkout preserved',b.get('added') and len(state['cart'])==1 and state['cart'][0]['product_size_id']==301)
        result['scenarios'][kind]={'first':a,'second':b,'observed_wait':True,'new_orders':1,'final_stock':0,'remaining_cart':state['cart']}

with fixture() as schema:
    with connect(schema) as conn:
        try:
            conn.execute('UPDATE cart_items SET quantity=0 WHERE id=55')
        except psycopg.errors.CheckViolation:
            check('database rejects zero quantity',True)
        else:
            raise AssertionError('CHECK should reject zero')

(ROOT/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2,default=str)+'\n')
(ROOT/'verified.js').write_text('window.SNEAKER_CHECKOUT = '+json.dumps(result,ensure_ascii=False,indent=2,default=str)+';\n')
print(f"Verified {len(result['checks'])} checkout checks, including real PostgreSQL lock waits.")
