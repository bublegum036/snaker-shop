"""Read-only preflight, executed with the backend venv; never prints settings."""
import os
from pathlib import Path
import sys

BACKEND = Path(__file__).resolve().parents[1] / "presentation" / "sneaker-practice"
sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)


def main():
    engine = None
    try:
        from alembic.config import Config
        from alembic.migration import MigrationContext
        from alembic.script import ScriptDirectory
        from app.core.config import jwt_secret
        from app.database import engine

        jwt_secret()
        config = Config(str(BACKEND / "alembic.ini"))
        expected = set(ScriptDirectory.from_config(config).get_heads())
        with engine.connect() as connection:
            actual = set(MigrationContext.configure(connection).get_current_heads())
        if actual != expected:
            print("Схема БД отстаёт от кода. Выполните make migrate.")
            return 1
        print("Подключение к БД, JWT-конфигурация и миграции проверены.")
        return 0
    except ImportError:
        print("В backend/.venv не хватает зависимостей. Установите requirements.txt.")
        return 1
    except Exception:
        # Driver exceptions can include connection details; do not print them.
        print("Не удалось проверить backend. Проверьте DATABASE_URL, JWT_SECRET и доступность БД.")
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
