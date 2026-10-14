"""Safe diagnostics: ASGI error tests and captured real Uvicorn HTTP logs."""
import asyncio
from contextlib import contextmanager
import io
import json
import logging
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from types import SimpleNamespace
from uuid import UUID
import httpx
from fastapi import FastAPI, HTTPException, Request
from app.core.request_logging import configure_request_logging, LOGGER_NAME, LoggedRequestError, RequestLoggingMiddleware

ROOT = Path(__file__).resolve().parent


@contextmanager
def captured_server():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    with tempfile.TemporaryDirectory(prefix='sneaker-log-check-') as temp, \
            (Path(temp) / 'server.log').open('w', encoding='utf-8') as output:
        process = subprocess.Popen(
            [sys.executable, '-m', 'uvicorn', 'app.final_main:app', '--host', '127.0.0.1', '--port', str(port)],
            cwd=ROOT, env=os.environ.copy(), stdout=output, stderr=output,
        )
        try:
            with httpx.Client(base_url=f'http://127.0.0.1:{port}', timeout=15, trust_env=False) as client:
                deadline = time.monotonic() + 15
                while True:
                    try:
                        if client.get('/health').status_code == 200:
                            break
                    except httpx.ConnectError:
                        pass
                    if time.monotonic() >= deadline or process.poll() is not None:
                        raise RuntimeError('Diagnostic verification server did not start')
                    time.sleep(.1)
                yield client, Path(temp) / 'server.log'
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


def verify():
    if os.getenv('SNEAKER_FINAL_DISPOSABLE') != 'yes':
        raise SystemExit('Run verify_final.py; HTTP diagnostic checks use its disposable database.')
    checks = []

    def check(label, condition):
        assert condition, label
        checks.append(label)

    async def asgi_checks():
        buffer = io.StringIO()
        logger = logging.getLogger(LOGGER_NAME)
        previous = (logger.handlers[:], logger.level, logger.propagate)
        access = logging.getLogger('uvicorn.access')
        access_disabled = access.disabled
        handler = logging.StreamHandler(buffer)
        handler.setFormatter(logging.Formatter('%(message)s'))
        logger.handlers = [handler]
        try:
            configure_request_logging()
            configure_request_logging()
            check('logging setup avoids duplicate handlers and disables raw access log',
                  len(logger.handlers) == 1 and access.disabled)
            app = FastAPI(debug=True)
            app.add_middleware(RequestLoggingMiddleware)

            @app.post('/ok')
            async def ok(request: Request):
                await request.body()
                await asyncio.sleep(.01)
                return {'request_id': request.state.request_id}

            @app.get('/handled')
            def handled():
                raise HTTPException(409, 'expected_conflict')

            @app.get('/explode')
            def explode():
                raise RuntimeError('exception-secret-marker')

            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
                responses = await asyncio.gather(*[
                    client.post('/ok?token=query-secret-marker',
                                headers={'Authorization': 'Bearer header-secret-marker',
                                         'Cookie': 'session=cookie-secret-marker',
                                         'X-Request-ID': 'incoming-secret-marker'},
                                json={'password': 'body-secret-marker'})
                    for _ in range(6)
                ])
                ids = [response.headers['x-request-id'] for response in responses]
                check('concurrent requests have independent UUIDs', len(set(ids)) == 6
                      and all(UUID(value).version == 4 for value in ids))
                check('response header matches request state', all(
                    r.status_code == 200 and r.json()['request_id'] == r.headers['x-request-id'] for r in responses))
                check('client supplied ID is not echoed', 'incoming-secret-marker' not in ids)
                response = await client.get('/handled')
                check('handled errors retain status and body plus request ID', response.status_code == 409
                      and response.json() == {'detail': 'expected_conflict'} and bool(response.headers.get('x-request-id')))
                response = await client.get('/explode')
                check('unexpected error returns safe JSON even in debug mode', response.status_code == 500
                      and response.json() == {'detail': 'internal_server_error',
                                              'request_id': response.headers['x-request-id']})
                error_id = response.headers['x-request-id']
                response = await client.get('/unknown/path-secret-marker?password=query-secret-marker')
                check('unknown route retains 404 plus request ID', response.status_code == 404
                      and bool(response.headers.get('x-request-id')))

            events = [json.loads(line) for line in buffer.getvalue().splitlines()]
            check('one structured log per HTTP request', len(events) == 9)
            check('parallel log IDs match response IDs', {e['request_id'] for e in events if e['path'] == '/ok'} == set(ids))
            check('logs carry method status duration and UTC timestamp', all(
                e['method'] in {'GET', 'POST'} and isinstance(e['status'], int)
                and e['duration_ms'] >= 0 and e['timestamp'].endswith('+00:00') for e in events))
            failure = next(e for e in events if e['request_id'] == error_id)
            check('unexpected error logs safe type and source locations', failure['level'] == 'ERROR'
                  and failure['event'] == 'request_failed' and failure['error']['type'] == 'RuntimeError'
                  and any(f['function'] == 'explode' for f in failure['error']['frames']))
            check('unknown raw path is replaced', events[-1]['path'] == '/<unmatched>')
            check('payload headers query path and exception text are absent from logs', all(
                marker not in buffer.getvalue() for marker in [
                    'query-secret-marker', 'header-secret-marker', 'cookie-secret-marker',
                    'incoming-secret-marker', 'body-secret-marker', 'exception-secret-marker', 'path-secret-marker',
                ]))

            messages = []

            async def receive():
                return {'type': 'http.request', 'body': b'', 'more_body': False}

            async def send(message):
                messages.append(message)

            async def partial(scope, receive, send):
                await send({'type': 'http.response.start', 'status': 200, 'headers': []})
                await send({'type': 'http.response.body', 'body': b'prefix', 'more_body': True})
                raise RuntimeError('stream-secret-marker')

            scope = {'type': 'http', 'method': 'GET', 'path': '/stream', 'headers': [],
                     'route': SimpleNamespace(path='/stream')}
            try:
                await RequestLoggingMiddleware(partial)(scope, receive, send)
            except LoggedRequestError as error:
                check('post-start error is safely propagated without original message',
                      'stream-secret-marker' not in str(error) and scope['state']['request_id'] in str(error))
            else:
                raise AssertionError('Partial response failure was swallowed')
            event = json.loads(buffer.getvalue().splitlines()[-1])
            check('partial response failure retains actual sent status', len(messages) == 2
                  and event['status'] == 200 and event['response_started'] and not event['response_completed'])
            check('partial response failure omits sensitive message', 'stream-secret-marker' not in buffer.getvalue())

            before = buffer.getvalue()

            async def lifecycle(scope, receive, send):
                await send({'type': 'lifespan.startup.complete'})

            await RequestLoggingMiddleware(lifecycle)({'type': 'lifespan'}, receive, send)
            check('non-HTTP lifecycle passes through without HTTP logs', buffer.getvalue() == before
                  and messages[-1]['type'] == 'lifespan.startup.complete')
        finally:
            logger.handlers, logger.level, logger.propagate = previous
            access.disabled = access_disabled

    asyncio.run(asgi_checks())
    # Capture both our logger and Uvicorn's output: raw URL secrets must be absent.
    with captured_server() as (client, output):
        responses = [
            client.get('/health?token=live-query-secret'),
            client.get('/products/2147483647'),
            client.get('/cart', headers={'Authorization': 'Bearer live-token-secret'}),
            client.post('/auth/login', json={'email': 'not-an-email', 'password': 'live-body-secret'}),
            client.get('/live-path-secret?password=live-query-secret'),
            client.get('/openapi.json'),
        ]
        check('real API keeps 200 404 401 422 responses', [r.status_code for r in responses] == [200, 404, 401, 422, 404, 200])
        check('real API includes request IDs on every response', all(UUID(r.headers['x-request-id']).version == 4 for r in responses))
        # Every request is logged on completion; the final response is tiny enough
        # that reading logs may still race the server's finally block briefly.
        deadline = time.monotonic() + 2
        expected = {r.headers['x-request-id'] for r in responses}
        while True:
            content = output.read_text(encoding='utf-8')
            events = [json.loads(line) for line in content.splitlines() if line.startswith('{')]
            if expected <= {e['request_id'] for e in events}:
                break
            if time.monotonic() >= deadline:
                raise AssertionError('Real API did not log all requests')
            time.sleep(.02)
        by_id = {e['request_id']: e for e in events}
        check('real logs correlate with headers and status codes', all(
            by_id[r.headers['x-request-id']]['status'] == r.status_code for r in responses))
        check('real logs use route templates', by_id[responses[1].headers['x-request-id']]['path'] == '/products/{product_id}')
        check('real server output omits raw URL tokens body and unknown paths', all(
            marker not in content for marker in ['live-query-secret', 'live-token-secret', 'live-body-secret', 'live-path-secret']))
        check('OpenAPI operation count remains 21', sum(
            method in {'get', 'post', 'put', 'patch', 'delete'}
            for methods in responses[-1].json()['paths'].values() for method in methods) == 21)
    (ROOT / 'logging-verification.json').write_text(json.dumps({'checks': checks}, ensure_ascii=False, indent=2) + '\n')
    print('Verified', len(checks), 'HTTP diagnostic checks; safe errors and real server logs passed.')


if __name__ == '__main__':
    verify()
