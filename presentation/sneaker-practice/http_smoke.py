"""Verify real HTTP, including stopping only this lesson's Compose database."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
import httpx

ROOT = Path(__file__).resolve().parent

def compose(*args):
    subprocess.run(['docker', 'compose', *args], cwd=ROOT, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)

def run():
    # Avoid cycling a database when the API is configured to use another service.
    from app.core.config import database_url
    from sqlalchemy.engine import make_url
    url = make_url(database_url())
    config = json.loads(subprocess.check_output(['docker','compose','config','--format','json'],cwd=ROOT,text=True))
    db = config['services']['db']
    assert config['name']=='sneaker-practice-m01'
    assert url.host=='127.0.0.1' and url.port==int(db['ports'][0]['published'])
    assert url.database==db['environment']['POSTGRES_DB'] and url.username==db['environment']['POSTGRES_USER']
    assert url.password==db['environment']['POSTGRES_PASSWORD']
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    compose('up', '-d', '--wait')
    process = subprocess.Popen([sys.executable,'-m','uvicorn','app.main:app','--host','127.0.0.1','--port',str(port)],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    report = {'checks': [], 'health': []}
    def record(label, condition):
        assert condition, label
        report['checks'].append(label)
    try:
        with httpx.Client(base_url=f'http://127.0.0.1:{port}', timeout=15, trust_env=False) as client:
            deadline = time.monotonic()+15
            while True:
                try:
                    response = client.get('/health')
                    break
                except httpx.ConnectError:
                    if time.monotonic()>=deadline or process.poll() is not None:
                        raise RuntimeError('Uvicorn did not start')
                    time.sleep(.1)
            record('GET /health returns 200 with live database',response.status_code==200 and response.json()=={'status':'ok'})
            report['health'].append({'stage':'up','status':response.status_code,'body':response.json()})
            record('/docs serves Swagger HTML',client.get('/docs').status_code==200)
            record('/openapi.json includes GET /health', 'get' in client.get('/openapi.json').json()['paths']['/health'])
            compose('stop','db')
            start=time.monotonic()
            response=client.get('/health')
            record('stopped database returns bounded 503',response.status_code==503 and response.json()=={'status':'unavailable'} and time.monotonic()-start<12)
            report['health'].append({'stage':'stopped','status':response.status_code,'body':response.json()})
            record('/docs remains available while DB is stopped',client.get('/docs').status_code==200)
            compose('up','-d','--wait')
            response=client.get('/health')
            record('same API process recovers to 200',response.status_code==200 and response.json()=={'status':'ok'})
            report['health'].append({'stage':'recovered','status':response.status_code,'body':response.json()})
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        compose('up','-d','--wait')
    serialized=json.dumps(report,ensure_ascii=False,indent=2)
    (ROOT/'http-verification.json').write_text(serialized+'\n')
    (ROOT/'http-verified.js').write_text('window.SNEAKER_M01_HTTP = '+serialized+';\n')
    print(f'Verified {len(report["checks"])} HTTP checks: 200 → 503 → 200.')

if __name__=='__main__':
    run()
