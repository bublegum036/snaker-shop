"""Проверить реальные примеры и обновить данные для слайдов.

Запуск: python verify.py из папки с этим файлом.
"""
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
import importlib.metadata
import json
import platform

from fastapi.testclient import TestClient
from demo import app
from minimal import app as minimal_app
from schemas import CartItemCreate, ProductCreate

ROOT = Path(__file__).resolve().parent
records = json.loads((ROOT / "snippets.json").read_text())
results = {}
for key, record in records.items():
    capture = StringIO()
    with redirect_stdout(capture):
        exec(compile(record["code"], f"slide_{key}.py", "exec"), {})
    output = capture.getvalue()
    assert output == record["expected"], (key, output, record["expected"])
    results[key] = {"code": record["code"], "output": output.rstrip("\n")}

with TestClient(minimal_app) as client:
    health = client.get("/health")
    assert health.status_code == 200 and health.json() == {"status": "ok"}
    assert client.post("/health").status_code == 405
    assert client.get("/missing").status_code == 404
    assert client.get("/docs").status_code == 200
    schema = client.get("/openapi.json").json()
    assert "/health" in schema["paths"]

with TestClient(app) as client:
    app.state.cart_handler_calls = 0
    invalid = client.post("/demo/cart/items", json={"product_size_id": 101, "quantity": 0})
    assert invalid.status_code == 422
    first_error = invalid.json()["detail"][0]
    assert first_error["loc"] == ["body", "quantity"]
    assert first_error["type"] == "greater_than"
    assert first_error["ctx"]["gt"] == 0
    for quantity in [-1, "2", True, 1.5]:
        response = client.post("/demo/cart/items", json={"product_size_id": 101, "quantity": quantity})
        assert response.status_code == 422, quantity
    assert app.state.cart_handler_calls == 0
    valid = client.post("/demo/cart/items", json={"product_size_id": 101, "quantity": 2})
    assert valid.status_code == 200
    assert valid.json() == {"product_size_id": 101, "quantity": 2}
    assert app.state.cart_handler_calls == 1

    user = client.get("/demo/user")
    assert user.status_code == 200
    assert user.json() == {"id": 7, "email": "anya@example.com"}
    assert "hashed_password" not in user.text

    created = client.post("/demo/products", json={"name": "North Runner", "price": "7990.00"})
    assert created.status_code == 201
    assert created.json() == {"id": 10, "name": "North Runner", "price": "7990.00"}
    for price in ["0", "-1.00", "7990.001", "100000000.00"]:
        assert client.post("/demo/products", json={"name": "North Runner", "price": price}).status_code == 422
    assert client.post("/demo/products", json={"name": "", "price": "7990.00"}).status_code == 422
    assert client.get("/demo/page").json() == {"limit": 10}
    assert client.get("/demo/page?limit=3").json() == {"limit": 3}
    assert client.get("/demo/page?limit=51").status_code == 422
    catalog = client.get("/products")
    assert catalog.status_code == 200 and len(catalog.json()) == 2
    assert client.get("/products/10").json()["name"] == "North Runner"
    assert client.get("/products/999").status_code == 404
    assert client.get("/products/abc").status_code == 422
    assert client.post("/products").status_code == 405
    paths = client.get("/openapi.json").json()["paths"]
    assert all(path in paths for path in ["/products", "/health", "/demo/cart/items", "/demo/page"])

results["32"] = {"code": (ROOT / "minimal.py").read_text().strip(), "output": json.dumps(health.json(), ensure_ascii=False)}
results["36"] = {"code": 'from pydantic import BaseModel, Field\n\nclass CartItemCreate(BaseModel):\n    product_size_id: int = Field(gt=0)\n    quantity: int = Field(gt=0, strict=True)', "output": json.dumps(valid.json(), ensure_ascii=False)}
# Ensure the displayed schema and the app validate the same example cases.
namespace = {}
exec(results["36"]["code"], namespace)
for quantity in [0, -1, 2, "2", True, 1.5]:
    outcomes = []
    for model in [CartItemCreate, namespace["CartItemCreate"]]:
        try:
            model(product_size_id=101, quantity=quantity)
            outcomes.append(True)
        except ValueError:
            outcomes.append(False)
    assert outcomes[0] == outcomes[1]
validation_cases = {}
with TestClient(app) as client:
    for key, quantity in [("good", 2), ("zero", 0), ("negative", -1), ("text", "2"), ("boolean", True)]:
        before = app.state.cart_handler_calls
        payload = {"product_size_id": 101, "quantity": quantity}
        response = client.post("/demo/cart/items", json=payload)
        called = app.state.cart_handler_calls - before
        assert called == (1 if key == "good" else 0)
        validation_cases[key] = {"input": payload, "status": response.status_code, "body": response.json(), "handler_calls": called}
results["37"] = {"status": 422, "error": first_error, "handler_calls": 0, "cases": validation_cases}
results["38"] = {"output": user.json()}
results["39"] = {"output": created.json()}
versions = {name: importlib.metadata.version(name) for name in ["fastapi", "pydantic", "uvicorn", "httpx"]}
report = {"python": platform.python_version(), "versions": versions, "python_examples": list(records), "checks": ["real Python output", "health / 404 / 405", "docs / OpenAPI", "validation / handler not called", "strict quantity", "response filtering", "product validation / decimal JSON", "Depends query validation", "router prefix / catalog"], "passed": True}
(ROOT / "verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
(ROOT / "verified.js").write_text('"use strict";\n// Generated by verify.py from executed Python and FastAPI examples.\nwindow.SNEAKER_EXAMPLES = ' + json.dumps({"results": results, "report": report}, ensure_ascii=False, indent=2) + ";\n")
print(json.dumps(report, ensure_ascii=False, indent=2))
