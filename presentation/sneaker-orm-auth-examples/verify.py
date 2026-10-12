"""Run ORM, real PostgreSQL migrations, and authenticated API checks."""
import contextlib
import io
import json
import secrets
from datetime import datetime, timedelta, timezone
from importlib.metadata import version
from pathlib import Path
from uuid import uuid4
from decimal import Decimal
from alembic import command
from alembic.config import Config
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import func, inspect, select, text
from sqlalchemy.exc import IntegrityError, ProgrammingError, InvalidRequestError
from sqlalchemy.orm import Session
from prepare import ensure_env

ensure_env()
from database import ROOT, make_engine
from models import Base, Product, Brand, User, Order
from schemas import ProductRead
from security import hash_password, verify_password, create_token, decode_token, ALGORITHM, ISSUER, AUDIENCE
from seed import seed, PASSWORDS
from api import make_app

schema = 'lesson78_verify_' + uuid4().hex
engine = make_engine(schema)
secret = secrets.token_urlsafe(48)
result = {'versions': {name:version(name) for name in ['sqlalchemy','alembic','psycopg','fastapi','pydantic','passlib','bcrypt','python-jose']}, 'orm':{}, 'migrations':{}, 'auth':{}, 'checks':[]}

def check(name, value):
    assert value, name
    result['checks'].append(name)

def migrate(target, down=False):
    config = Config(str(ROOT/'alembic.ini'))
    with engine.connect() as conn:
        config.attributes['connection'] = conn
        (command.downgrade if down else command.upgrade)(config, target)

def revision():
    with engine.connect() as conn:
        return conn.scalar(text('SELECT version_num FROM alembic_version'))

def contains_image():
    return 'image_url' in [col['name'] for col in inspect(engine).get_columns('products')]

try:
    with engine.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA "{schema}"'))
    migrate('0001')
    check('first migration: seven tables without image_url', not contains_image() and len(inspect(engine).get_table_names())==8)
    result['migrations']['before'] = {'revision':revision(),'image_url':contains_image()}
    try:
        with Session(engine) as session:
            session.scalars(select(Product)).all()
    except ProgrammingError as error:
        check('new model against old table rejected', error.orig.sqlstate=='42703')
        result['migrations']['mismatch_sqlstate'] = error.orig.sqlstate
    else:
        raise AssertionError('Expected undefined column error')
    migrate('head')
    result['migrations']['after'] = {'revision':revision(),'image_url':contains_image()}
    check('second migration adds image_url', contains_image() and revision()=='0002')
    migrate('0001', down=True)
    check('downgrade removes image_url', not contains_image())
    migrate('head')
    with engine.connect() as conn:
        differences = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    check('head matches ORM metadata', not differences)
    seed(engine)
    with Session(engine) as session:
        before_counts={table.name:session.scalar(select(func.count()).select_from(table)) for table in Base.metadata.sorted_tables}
        before_hash=session.get(User,7).hashed_password
    seed(engine)
    with Session(engine) as session:
        after_counts={table.name:session.scalar(select(func.count()).select_from(table)) for table in Base.metadata.sorted_tables}
        check('repeat seed preserves row counts and existing password', before_counts==after_counts and before_hash==session.get(User,7).hashed_password)
        result['migrations']['seed_counts']=after_counts
        product=session.scalar(select(Product).where(Product.id==10))
        result['orm']['found']=ProductRead.model_validate(product).model_dump(mode='json')
        result['orm']['missing']=session.scalar(select(Product).where(Product.id==999))
        result['orm']['relationship']={'brand_id':product.brand_id,'brand_name':product.brand.name}
        check('select and relationship', product.brand.name=='North' and result['orm']['missing'] is None)
        check('Decimal JSON serialization', result['orm']['found']['price']=='7990.00')
        check('SELECT starts transaction via autobegin', session.in_transaction())
        try:
            with session.begin():
                pass
        except InvalidRequestError:
            result['orm']['autobegin_requires_boundary']=True
        else:
            raise AssertionError('Existing transaction should be visible')
    with Session(engine) as session:
        product=Product(name='ORM Demo',brand_id=1,price=Decimal('100.00'))
        states=[{'step':'new','id':product.id,'visible_elsewhere':False}]
        session.add(product)
        states.append({'step':'add','id':product.id,'visible_elsewhere':False})
        session.flush()
        product_id=product.id
        with Session(engine) as observer:
            visible=observer.get(Product,product_id) is not None
        states.append({'step':'flush','id':product_id,'visible_elsewhere':visible})
        check('flush gives ID without visibility in another connection', product_id is not None and not visible)
        session.commit()
    with Session(engine) as observer:
        visible=observer.get(Product,product_id) is not None
    states.append({'step':'commit','id':product_id,'visible_elsewhere':visible})
    check('commit visible to a new transaction', visible)
    result['orm']['write_states']=states
    try:
        with Session(engine) as session, session.begin():
            session.add(Brand(name='Rollback Demo'))
            session.flush()
            raise RuntimeError('Deliberate lesson failure')
    except RuntimeError:
        pass
    with Session(engine) as session:
        check('exception rolls back flushed data', session.scalar(select(Brand).where(Brand.name=='Rollback Demo')) is None)
        session.add(Product(name='Invalid price',brand_id=1,price=Decimal('-1')))
        try:
            session.flush()
        except IntegrityError:
            session.rollback()
        check('session reusable after explicit rollback of failed flush', session.scalar(select(func.count()).select_from(Brand))==2)
    result['orm']['rollback']={'flushed_row_exists':False,'session_reusable_after_rollback':True}
    first,second=hash_password('Example-A7!'),hash_password('Example-A7!')
    result['auth']['hash']={'hashes_differ':first!=second,'correct_password':verify_password('Example-A7!',first),'wrong_password':verify_password('Wrong-A7!',first)}
    check('bcrypt salts and password verification', result['auth']['hash']=={'hashes_differ':True,'correct_password':True,'wrong_password':False})
    app=make_app(engine,secret)
    with TestClient(app) as client:
        register={'email':'new@example.com','password':'New-demo-N1!'}
        response=client.post('/auth/register',json=register)
        check('registration excludes hash and role',response.status_code==201 and set(response.json())=={'id','email'})
        result['auth']['register']={'status':response.status_code,'body':response.json()}
        check('duplicate email conflict', client.post('/auth/register',json=register).status_code==409)
        check('client cannot register as admin',client.post('/auth/register',json={**register,'email':'evil@example.com','is_admin':True}).status_code==422)
        check('bcrypt UTF-8 byte limit enforced',client.post('/auth/register',json={'email':'long@example.com','password':'я'*40}).status_code==422)
        wrong=client.post('/auth/login',json={'email':'anya@example.com','password':'Wrong-demo-A1!'})
        unknown=client.post('/auth/login',json={'email':'nobody@example.com','password':'Wrong-demo-A1!'})
        check('unknown user and wrong password have same response',wrong.status_code==unknown.status_code==401 and wrong.json()==unknown.json())
        tokens={}
        for user_id,email in [(7,'anya@example.com'),(8,'boris@example.com'),(9,'admin@example.com')]:
            response=client.post('/auth/login',json={'email':email,'password':PASSWORDS[user_id]})
            check(f'login user {user_id}',response.status_code==200)
            tokens[user_id]=response.json()['access_token']
        result['auth']['claims']=decode_token(tokens[7],secret)
        def request(path,token=None):
            response=client.get(path,headers={'Authorization':'Bearer '+token} if token else {})
            return {'status':response.status_code,'body':response.json()}
        expired=create_token(7,secret,datetime.now(timezone.utc)-timedelta(seconds=60))
        bad_signature=create_token(7,secrets.token_urlsafe(48))
        missing_exp=jwt.encode({'sub':'7','iss':ISSUER,'aud':AUDIENCE},secret,algorithm=ALGORITHM)
        bad_algorithm=jwt.encode({'sub':'7','exp':datetime.now(timezone.utc)+timedelta(minutes=5),'iss':ISSUER,'aud':AUDIENCE},secret,algorithm='HS512')
        scenarios={
            'none':('/auth/me',None,401), 'expired':('/auth/me',expired,401),
            'signature':('/auth/me',bad_signature,401), 'missing_user':('/auth/me',create_token(999,secret),401),
            'no_exp':('/auth/me',missing_exp,401), 'algorithm':('/auth/me',bad_algorithm,401),
            'valid':('/auth/me',tokens[7],200), 'not_admin':('/admin/check',tokens[7],403),
            'admin':('/admin/check',tokens[9],200), 'own_order':('/orders/501',tokens[7],200),
            'other_order':('/orders/501',tokens[8],404), 'absent_order':('/orders/999',tokens[8],404),
        }
        for name,(path,token,status) in scenarios.items():
            found=request(path,token)
            check('access case: '+name,found['status']==status)
            result['auth'][name]={'path':path,**found}
        check('foreign order hidden like absent order',result['auth']['other_order']['body']==result['auth']['absent_order']['body'])
        check('responses contain no password hash',all('hashed_password' not in str(value) for value in result['auth'].values()))
        # A signed role claim must not override the current database role.
        claimed=jwt.encode({**decode_token(tokens[7],secret),'is_admin':True},secret,algorithm=ALGORITHM)
        check('role claim does not override DB role',request('/admin/check',claimed)['status']==403)
        with engine.begin() as conn:
            conn.execute(text('UPDATE users SET is_admin=false WHERE id=9'))
        check('old token does not retain revoked admin permission',request('/admin/check',tokens[9])['status']==403)
    result['checked_at']=datetime.now(timezone.utc).isoformat()
finally:
    # Only the unique schema created at the top of this invocation is removed.
    engine.dispose()
    with engine.begin() as conn:
        conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
    engine.dispose()

(ROOT/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
(ROOT/'verified.js').write_text('window.SNEAKER_ORM_AUTH = '+json.dumps(result,ensure_ascii=False,indent=2)+';\n')
print(f"Verified {len(result['checks'])} checks: migrations, ORM, hashing, JWT, API ownership and roles.")
