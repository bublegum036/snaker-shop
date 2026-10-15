"""Supervisor safety checks use only ephemeral sockets and test-owned processes."""
import importlib.util
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("shop_dev", Path(__file__).resolve().parents[1] / "dev.py")
dev = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dev)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'{"status":"ok"}' if self.path == "/health" else b'{"status":"unavailable"}')


class LauncherTests(unittest.TestCase):
    def test_busy_port_is_refused_without_stopping_its_owner(self):
        with socket.socket() as foreign:
            foreign.bind(("127.0.0.1", 0))
            foreign.listen()
            port = foreign.getsockname()[1]
            with self.assertRaises(dev.DevError):
                dev.require_free_port(port)
            self.assertEqual(foreign.getsockname()[1], port)

    def test_health_checks_json_not_just_http_200(self):
        with ThreadingHTTPServer(("127.0.0.1", 0), Handler) as server:
            worker = threading.Thread(target=server.serve_forever)
            worker.start()
            try:
                url = f"http://127.0.0.1:{server.server_port}"
                self.assertTrue(dev.health(url + "/health"))
                self.assertFalse(dev.health(url + "/wrong"))
            finally:
                server.shutdown()
                worker.join()

    def test_stop_signals_only_test_owned_groups(self):
        command = [sys.executable, "-c", "import time; time.sleep(60)"]
        owned = subprocess.Popen(command, start_new_session=True)
        unrelated = subprocess.Popen(command, start_new_session=True)
        try:
            dev.stop_children([owned])
            self.assertIsNotNone(owned.poll())
            self.assertIsNone(unrelated.poll())
        finally:
            dev.stop_children([owned, unrelated])

    def test_only_one_supervisor_can_acquire_workspace_lock(self):
        with tempfile.TemporaryDirectory(dir="/tmp") as directory:
            with patch.object(dev, "RUNTIME", Path(directory)):
                with dev.supervisor_lock():
                    with self.assertRaises(dev.DevError):
                        with dev.supervisor_lock():
                            self.fail("Second launcher obtained the lock")

    def test_status_and_stop_use_private_control_socket(self):
        with tempfile.TemporaryDirectory(dir="/tmp") as directory:
            control = Path(directory) / "control.sock"
            supervisor = dev.Supervisor(18001, 14201)
            with patch.object(dev, "CONTROL", control), socket.socket(socket.AF_UNIX) as listener:
                listener.bind(str(control))
                listener.listen()
                listener.settimeout(2)
                for command, state in (("status", "starting"), ("stop", "stopping")):
                    worker = threading.Thread(target=supervisor.handle_control, args=(listener,))
                    worker.start()
                    self.assertEqual(dev.control_request(command)["state"], state)
                    worker.join(timeout=3)
                    self.assertFalse(worker.is_alive())
                self.assertTrue(supervisor.stopping)

    def test_missing_control_socket_is_inactive_and_stop_is_safe(self):
        with tempfile.TemporaryDirectory(dir="/tmp") as directory:
            with patch.object(dev, "CONTROL", Path(directory) / "absent.sock"):
                self.assertEqual(dev.control_request("stop"), {"state": "inactive"})


if __name__ == "__main__":
    unittest.main()
