.DEFAULT_GOAL := help
PYTHON ?= python3
API_PORT ?= 8000
WEB_PORT ?= 4200

.PHONY: help dev status stop db migrate seed check check-launcher
help:
	@$(PYTHON) scripts/dev.py --help

dev:
	@$(PYTHON) scripts/dev.py start --api-port "$(API_PORT)" --web-port "$(WEB_PORT)"

status:
	@$(PYTHON) scripts/dev.py status

stop:
	@$(PYTHON) scripts/dev.py stop

db:
	@$(PYTHON) scripts/dev.py db

migrate:
	@$(PYTHON) scripts/dev.py migrate

seed:
	@$(PYTHON) scripts/dev.py seed

check:
	@$(PYTHON) scripts/dev.py check

check-launcher:
	@$(PYTHON) -m unittest discover -s scripts/tests -v
