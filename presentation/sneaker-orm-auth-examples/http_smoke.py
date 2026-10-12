"""Smoke check a real Uvicorn server on an OS-assigned local port."""
import json
import socket
import subprocess
import sys
import time
from pathlib import Path
import httpx

root = Path(__file__).resolve().parent
sock = socket.socket()
sock.bind(('127.0.0.1', 0))
sock.listen(128)
port = sock.getsockname()[1]
process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'run:app', '--fd', str(sock.fileno()), '--no-access-log', '--log-level', 'error'], cwd=root, pass_fds=(sock.fileno(),), stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
results = {}
try:
    with httpx.Client(base_url=f'http://127.0.0.1:{port}', timeout=3) as client:
        for attempt in range(50):
            if process.poll() is not None:
                raise RuntimeError('Uvicorn failed to start')
            try:
                response = client.get('/openapi.json')
                if response.status_code == 200:
                    break
            except httpx.TransportError:
                pass
            time.sleep(.1)
        else:
            raise RuntimeError('Uvicorn startup timeout')
        results['openapi'] = response.status_code
        results['docs'] = client.get('/docs').status_code
        results['anonymous'] = client.get('/auth/me').status_code
        login = client.post('/auth/login', json={'email':'anya@example.com','password':'Anya-demo-A7!'})
        assert login.status_code == 200
        token = login.json()['access_token']
        headers = {'Authorization':'Bearer '+token}
        results['login'] = login.status_code
        me = client.get('/auth/me', headers=headers)
        results['me'] = me.status_code
        assert me.json() == {'id':7,'email':'anya@example.com'}
        results['own_order'] = client.get('/orders/501', headers=headers).status_code
        results['not_admin'] = client.get('/admin/check', headers=headers).status_code
        assert results == {'openapi':200,'docs':200,'anonymous':401,'login':200,'me':200,'own_order':200,'not_admin':403}
finally:
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()
    sock.close()
(root/'http-verification.json').write_text(json.dumps(results, indent=2)+'\n')
print('Real HTTP verified: docs, OpenAPI, login, current user, ownership and admin denial.')
