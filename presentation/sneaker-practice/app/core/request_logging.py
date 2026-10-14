"""Structured HTTP diagnostics without request payloads or exception messages."""
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
import time
import traceback
from uuid import uuid4
from starlette.datastructures import MutableHeaders
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

LOGGER_NAME = 'sneaker.requests'
PUBLIC_PATHS = {'/docs', '/redoc', '/openapi.json', '/docs/oauth2-redirect'}
METHODS = {'GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE', 'CONNECT'}


def configure_request_logging():
    logger = logging.getLogger(LOGGER_NAME)
    logger.setLevel(logging.INFO)
    logger.propagate = False
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter('%(message)s'))
        logger.addHandler(handler)
    # Uvicorn's default access log includes the raw URL and query string.
    logging.getLogger('uvicorn.access').disabled = True


def safe_path(scope):
    route = scope.get('route')
    if route is not None and hasattr(route, 'path'):
        return route.path
    path = scope.get('path', '')
    return path if path in PUBLIC_PATHS else '/<unmatched>'


class LoggedRequestError(RuntimeError):
    """Safe replacement when a failed response has already started."""


class RequestLoggingMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return

        # Generate our own ID: never echo or log untrusted X-Request-ID values.
        request_id = str(uuid4())
        scope.setdefault('state', {})['request_id'] = request_id
        start = time.perf_counter()
        status = None
        started = False
        completed = False
        failure = None

        async def tracked_send(message: Message):
            nonlocal status, started, completed
            if message['type'] == 'http.response.start':
                status = message['status']
                MutableHeaders(scope=message)['X-Request-ID'] = request_id
            await send(message)
            if message['type'] == 'http.response.start':
                started = True
            elif message['type'] == 'http.response.body' and not message.get('more_body', False):
                completed = True

        try:
            await self.app(scope, receive, tracked_send)
        except Exception as error:
            # str(error), SQL params and traceback source lines can contain secrets.
            failure = {
                'type': type(error).__name__,
                'frames': [
                    {'file': Path(frame.filename).name, 'line': frame.lineno, 'function': frame.name}
                    for frame in traceback.extract_tb(error.__traceback__)[-12:]
                ],
            }
            if started:
                # HTTP status cannot be changed after response.start. Propagate only
                # a safe replacement so Uvicorn won't print the original exception.
                raise LoggedRequestError('Response failed; request_id=' + request_id) from None
            response = JSONResponse(status_code=500, content={
                'detail': 'internal_server_error', 'request_id': request_id,
            })
            try:
                await response(scope, receive, tracked_send)
            except Exception:
                raise LoggedRequestError('Response delivery failed; request_id=' + request_id) from None
        finally:
            level = logging.ERROR if failure is not None or (status is not None and status >= 500) else logging.INFO
            event = {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'level': logging.getLevelName(level),
                'event': 'request_failed' if failure else 'http_request',
                'request_id': request_id,
                'method': scope['method'] if scope['method'] in METHODS else 'OTHER',
                'path': safe_path(scope),
                'status': status,
                'duration_ms': round((time.perf_counter() - start) * 1000, 3),
                'response_started': started,
                'response_completed': completed,
            }
            if failure is not None:
                event['error'] = failure
            logging.getLogger(LOGGER_NAME).log(level, json.dumps(event, ensure_ascii=True))
