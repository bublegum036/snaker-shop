"""Local macOS/Linux supervisor. No PID files, external kills or implicit migrations."""
import argparse
from contextlib import contextmanager
import fcntl
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import time
from urllib.request import build_opener, ProxyHandler

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "presentation" / "sneaker-practice"
FRONTEND = ROOT / "frontend"
RUNTIME = ROOT / ".local" / "dev"
CONTROL = RUNTIME / "control.sock"
HTTP = build_opener(ProxyHandler({}))  # Loopback readiness must not use HTTP_PROXY.


class DevError(Exception):
    pass


def backend_python():
    executable = BACKEND / ".venv" / "bin" / "python"
    if not executable.is_file() or not (BACKEND / ".env").is_file():
        raise DevError("Сначала создайте backend .venv и .env по presentation/sneaker-practice/README.md.")
    return str(executable)


def node_environment():
    version = (FRONTEND / ".nvmrc").read_text().strip()
    nvm = Path(os.environ.get("NVM_DIR", str(Path.home() / ".nvm")))
    pinned = nvm / "versions" / "node" / ("v" + version) / "bin" / "node"
    executable = str(pinned) if pinned.is_file() else shutil.which("node")
    if not executable:
        raise DevError("Node.js не найден. Выполните cd frontend && nvm install && nvm use.")
    parts = subprocess.check_output([executable, "--version"], text=True).strip().lstrip("v").split(".")
    major, minor = map(int, parts[:2])
    if not (major >= 24 or major == 22 and minor >= 13 or major == 20 and minor >= 19):
        raise DevError("Версия Node.js не подходит. Выполните cd frontend && nvm use.")
    env = os.environ.copy()
    env["PATH"] = str(Path(executable).parent) + os.pathsep + env.get("PATH", "")
    return executable, env


def require_free_port(port):
    with socket.socket() as probe:
        try:
            probe.bind(("127.0.0.1", port))
        except OSError:
            raise DevError(f"Порт {port} занят. Остановите прежний сервер вручную или выберите другой порт.") from None


def health(url):
    try:
        with HTTP.open(url, timeout=1) as response:
            return response.status == 200 and json.load(response) == {"status": "ok"}
    except (OSError, ValueError):
        return False


def frontend_ready(url):
    try:
        with HTTP.open(url, timeout=1) as response:
            return response.status == 200 and b'id="app"' in response.read(100_000)
    except OSError:
        return False


def run_command(args, cwd, message, env=None):
    try:
        result = subprocess.run(args, cwd=cwd, env=env, timeout=60,
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except (OSError, subprocess.TimeoutExpired):
        raise DevError(message) from None
    if result.returncode:
        raise DevError(message)


def start_database():
    backend_python()
    print("Проверяю PostgreSQL через Docker Compose…", flush=True)
    run_command(["docker", "compose", "-f", str(BACKEND / "compose.yaml"),
                 "up", "-d", "--wait", "--wait-timeout", "45", "db"], BACKEND,
                "PostgreSQL не готов. Проверьте Docker Desktop и backend .env; подробности: docker compose ps из backend.")


@contextmanager
def supervisor_lock():
    RUNTIME.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (RUNTIME / "lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise DevError("Общий запуск уже активен. Используйте make status или make stop.") from None
        yield


def stop_children(children):
    # Only groups created with start_new_session by this supervisor are signalled.
    for child in children:
        try:
            os.killpg(child.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    for child in children:
        try:
            child.wait(timeout=8)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            child.wait(timeout=3)


def control_request(command):
    try:
        with socket.socket(socket.AF_UNIX) as client:
            client.settimeout(5)
            client.connect(str(CONTROL))
            client.sendall(command.encode() + b"\n")
            return json.loads(client.makefile("rb").readline(8192))
    except (FileNotFoundError, ConnectionRefusedError):
        return {"state": "inactive"}
    except (OSError, ValueError):
        raise DevError("Общий запуск не отвечает. Проверьте его терминал; чужие процессы не останавливались.") from None


class Supervisor:
    def __init__(self, api_port, web_port):
        self.api = f"http://127.0.0.1:{api_port}"
        self.web = f"http://127.0.0.1:{web_port}"
        self.children = []
        self.stopping = False
        self.ready = False

    def snapshot(self):
        if not self.ready:
            return {"state": "starting", "api": self.api, "frontend": self.web}
        api_ok = health(self.api + "/health")
        web_ok = frontend_ready(self.web) and health(self.web + "/api/health")
        alive = all(child.poll() is None for child in self.children)
        return {"state": "ready" if api_ok and web_ok and alive else "unhealthy",
                "api": self.api, "frontend": self.web,
                "api_healthy": api_ok, "frontend_and_proxy_healthy": web_ok}

    def handle_control(self, listener):
        try:
            connection, _ = listener.accept()
        except socket.timeout:
            return
        with connection:
            connection.settimeout(1)
            try:
                command = connection.recv(32).strip()
                if command == b"stop":
                    self.stopping = True
                    response = {"state": "stopping"}
                elif command == b"status":
                    response = self.snapshot()
                else:
                    response = {"state": "unknown-command"}
                connection.sendall(json.dumps(response).encode() + b"\n")
            except OSError:
                pass

    def request_stop(self, _signum, _frame):
        self.stopping = True

    def ensure_children_alive(self):
        if any(child.poll() is not None for child in self.children):
            raise DevError("Один из серверов завершился. Останавливаю остальные; проверьте вывод выше.")

    def run(self, api_port, web_port):
        with supervisor_lock():
            if api_port == web_port:
                raise DevError("Фронтенду и API нужны разные порты.")
            require_free_port(api_port)
            require_free_port(web_port)
            python = backend_python()
            node, env = node_environment()
            vite = FRONTEND / "node_modules" / "vite" / "bin" / "vite.js"
            if not vite.is_file():
                raise DevError("Нет frontend/node_modules. Выполните cd frontend && npm ci.")
            start_database()
            result = subprocess.run([python, str(ROOT / "scripts" / "check_local_backend.py")],
                                    cwd=BACKEND, capture_output=True, text=True, timeout=15)
            print(result.stdout.strip(), flush=True)
            if result.returncode:
                raise DevError("Проверка backend не пройдена. Данные и миграции автоматически не менялись.")
            CONTROL.unlink(missing_ok=True)  # Lock held: only a stale socket can exist.
            with socket.socket(socket.AF_UNIX) as listener:
                listener.bind(str(CONTROL))
                CONTROL.chmod(0o600)
                listener.listen(4)
                listener.settimeout(0.2)
                original_signals = {sig: signal.signal(sig, self.request_stop)
                                    for sig in (signal.SIGINT, signal.SIGTERM)}
                try:
                    env["SNEAKER_API_TARGET"] = self.api
                    self.children.append(subprocess.Popen(
                        [python, "-m", "uvicorn", "app.final_main:app", "--reload", "--host", "127.0.0.1", "--port", str(api_port)],
                        cwd=BACKEND, start_new_session=True))
                    self.children.append(subprocess.Popen(
                        [node, str(vite), "--host", "127.0.0.1", "--strictPort", "--port", str(web_port)],
                        cwd=FRONTEND, env=env, start_new_session=True))
                    deadline = time.monotonic() + 30
                    while not self.stopping:
                        self.ensure_children_alive()
                        if health(self.api + "/health") and frontend_ready(self.web) and health(self.web + "/api/health"):
                            self.ready = True
                            break
                        if time.monotonic() > deadline:
                            raise DevError("Серверы не стали готовы за 30 секунд; останавливаю общий запуск.")
                        self.handle_control(listener)
                    if self.ready:
                        print(f"\nГотово: {self.web}\nSwagger: {self.api}/docs\nОстановка: Ctrl+C или make stop в другом терминале.\n", flush=True)
                    while not self.stopping:
                        self.ensure_children_alive()
                        self.handle_control(listener)
                finally:
                    try:
                        stop_children(self.children)
                    finally:
                        CONTROL.unlink(missing_ok=True)
                        for sig, handler in original_signals.items():
                            signal.signal(sig, handler)
                    print("Фронтенд и API общего запуска остановлены. PostgreSQL оставлен работать.", flush=True)


def port(value):
    number = int(value)
    if not 1024 <= number <= 65535:
        raise argparse.ArgumentTypeError("Выберите порт от 1024 до 65535")
    return number


def main():
    parser = argparse.ArgumentParser(description="Локальный магазин: start / status / stop; db / migrate / seed / check.")
    parser.add_argument("command", choices=["start", "status", "stop", "db", "migrate", "seed", "check"])
    parser.add_argument("--api-port", type=port, default=8000)
    parser.add_argument("--web-port", type=port, default=4200)
    args = parser.parse_args()
    try:
        if args.command == "start":
            Supervisor(args.api_port, args.web_port).run(args.api_port, args.web_port)
        elif args.command in ("status", "stop"):
            result = control_request(args.command)
            if args.command == "stop" and result["state"] == "stopping":
                deadline = time.monotonic() + 25
                while CONTROL.exists():
                    if time.monotonic() > deadline:
                        raise DevError("Остановка ещё не завершилась. Проверьте терминал общего запуска.")
                    time.sleep(0.1)
                result = {"state": "stopped"}
            print(json.dumps(result, ensure_ascii=False, indent=2))
            if args.command == "status" and result["state"] != "ready":
                return 1
        elif args.command == "db":
            start_database()
        elif args.command in ("migrate", "seed"):
            module = ["alembic", "upgrade", "head"] if args.command == "migrate" else ["app.seed"]
            return subprocess.call([backend_python(), "-m", *module], cwd=BACKEND)
        elif args.command == "check":
            _, env = node_environment()
            return subprocess.call(["npm", "run", "check"], cwd=FRONTEND, env=env)
        return 0
    except KeyboardInterrupt:
        return 130
    except (DevError, OSError, subprocess.SubprocessError) as error:
        message = str(error) if isinstance(error, DevError) else "Команда не выполнена. Проверьте зависимости и локальное окружение."
        print(message, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
