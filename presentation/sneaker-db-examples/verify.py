"""Execute teaching SQL in PostgreSQL; rollback every temporary schema."""
import json
import subprocess
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BASE = ['docker', 'compose', 'exec', '-T', 'db', 'psql', '-X', '-qAt', '-U', 'lesson', '-d', 'sneaker_lesson', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate']
DDL = (ROOT/'sql/schema.sql').read_text() + (ROOT/'sql/seed.sql').read_text()

def run(sql, fixture=True):
    schema = 'verify_' + uuid.uuid4().hex
    body = f'BEGIN; CREATE SCHEMA {schema}; SET LOCAL search_path TO {schema};\n'
    return subprocess.run(BASE, input=body+(DDL if fixture else '')+'\n'+sql+'\nROLLBACK;', text=True, capture_output=True, cwd=ROOT)

def rows(sql):
    result = run('SELECT COALESCE(json_agg(t),\'[]\'::json) FROM ('+sql.rstrip(';')+') t;')
    if result.returncode:
        raise RuntimeError(result.stderr)
    return json.loads(result.stdout)

queries = {
    'cheap': 'SELECT id, name, price\nFROM products\nWHERE price <= 8000\nORDER BY price, id\nLIMIT 10;',
    'north': 'SELECT id, name, price\nFROM products\nWHERE brand_id = 1\nORDER BY price, id\nLIMIT 10;',
    'first': 'SELECT id, name, price\nFROM products\nORDER BY price, id\nLIMIT 1;',
    'join': (ROOT/'sql/join.sql').read_text().strip(),
}
result = {'engine': rows('SELECT version() AS version')[0]['version'], 'queries': {}, 'tables': {}, 'checks': []}
for key, sql in queries.items():
    result['queries'][key] = {'sql': sql, 'rows': rows(sql)}
assert [x['id'] for x in result['queries']['cheap']['rows']] == [20, 10]
assert [x['id'] for x in result['queries']['north']['rows']] == [10, 30]
assert result['queries']['join']['rows'][0]['brand'] == 'North'
for name, columns in {
    'users':'id, email, is_admin', 'brands':'id, name',
    'products':'id, name, brand_id, price', 'product_sizes':'id, product_id, size, stock',
    'cart_items':'id, user_id, product_size_id, quantity', 'orders':'id, user_id, status, total',
    'order_items':'id, order_id, product_size_id, quantity, price_at_purchase'
}.items():
    result['tables'][name] = rows(f'SELECT {columns} FROM {name} ORDER BY id')
for label, sql, state in [
    ('NOT NULL', 'INSERT INTO brands(name) VALUES (NULL);', '23502'),
    ('UNIQUE', "INSERT INTO brands(name) VALUES ('North');", '23505'),
    ('FOREIGN KEY', "INSERT INTO products(name,brand_id,price) VALUES ('X',999,100);", '23503'),
    ('CHECK', 'UPDATE product_sizes SET stock=-1 WHERE id=101;', '23514'),
    ('UNIQUE cart pair', 'INSERT INTO cart_items(user_id,product_size_id,quantity) VALUES(7,101,1);', '23505'),
]:
    out = run(sql)
    assert out.returncode != 0 and state in out.stderr, (label, out.stderr)
    result['checks'].append({'constraint':label, 'sqlstate':state, 'rejected':True})
result['changes'] = []
changes = ["INSERT INTO brands(id, name)\nVALUES (99, 'Demo');", "UPDATE brands\nSET name = 'Demo Updated'\nWHERE id = 99;", 'DELETE FROM brands\nWHERE id = 99;']
prior = ''
for sql in changes:
    prior += sql+'\n'
    out = run(prior+"SELECT COALESCE(json_agg(t),'[]'::json) FROM (SELECT id,name FROM brands WHERE id=99) t;")
    assert out.returncode == 0, out.stderr
    result['changes'].append({'sql':sql, 'rows':json.loads(out.stdout)})
assert result['changes'][-1]['rows'] == []
trace = rows('SELECT oi.id, u.email, b.name AS brand FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN users u ON u.id=o.user_id JOIN product_sizes ps ON ps.id=oi.product_size_id JOIN products p ON p.id=ps.product_id JOIN brands b ON b.id=p.brand_id WHERE oi.id=601')
assert trace == [{'id':601, 'email':'anya@example.com','brand':'North'}]
result['trace'] = trace[0]
out = run("UPDATE products SET price=8990 WHERE id=10; SELECT price_at_purchase FROM order_items WHERE id=601;")
assert out.returncode == 0 and out.stdout.strip() == '7990.00', out.stderr
result['checks'].append({'constraint':'purchase price snapshot', 'unchanged':True})
(ROOT/'verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
(ROOT/'verified.js').write_text('window.SNEAKER_DB = '+json.dumps(result, ensure_ascii=False, indent=2)+';\n')
print(f"Verified: 7 tables, {len(queries)} queries, 3 mutations, {len(result['checks'])} checks, order trace.")
