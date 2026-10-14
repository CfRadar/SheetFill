# ==============================================================================
# Flipkart T-Shirt Listing Automation Makefile
# ==============================================================================

ifeq ($(OS),Windows_NT)
	VENV ?= .venv
	BIN ?= $(VENV)/Scripts
	PYTHON ?= $(BIN)/python.exe
	UVICORN ?= $(BIN)/uvicorn.exe
	PYTEST ?= $(BIN)/pytest.exe
	ACTIVATE ?= . $(BIN)/activate
else
	VENV ?= .venv
	BIN ?= $(VENV)/bin
	PYTHON ?= $(BIN)/python
	UVICORN ?= $(BIN)/uvicorn
	PYTEST ?= $(BIN)/pytest
	ACTIVATE ?= . $(BIN)/activate
endif

HOST ?= 127.0.0.1
PORT ?= 8000

.PHONY: help install venv backend frontend build test clean run

help:
	@echo "Available commands:"
	@echo "  make backend   - Activate venv and run FastAPI backend server (http://$(HOST):$(PORT))"
	@echo "  make frontend  - Install npm packages (if needed) and run Vite dev server (http://localhost:3000)"
	@echo "  make run       - Build frontend and run unified server on http://$(HOST):$(PORT)"
	@echo "  make build     - Build frontend production bundle into frontend/dist"
	@echo "  make test      - Run test suite with pytest inside venv"
	@echo "  make install   - Set up Python venv, install Python requirements, and install frontend npm packages"
	@echo "  make clean     - Remove Python cache, temporary test files, and frontend dist"

venv:
	@if [ ! -d "$(VENV)" ]; then \
		echo "Creating virtual environment in $(VENV)..."; \
		python -m venv $(VENV) || python3 -m venv $(VENV) || py -m venv $(VENV); \
		$(PYTHON) -m pip install -q --upgrade pip; \
		$(PYTHON) -m pip install -q -r requirements.txt; \
		$(PYTHON) -m pip install -q -e .; \
	fi

install: venv
	@echo "Installing frontend npm packages..."
	cd frontend && npm install

backend: venv
	@echo "======================================================="
	@echo "Starting FastAPI Backend Server..."
	@echo "API URL: http://$(HOST):$(PORT)"
	@echo "Docs:    http://$(HOST):$(PORT)/docs"
	@echo "======================================================="
	$(PYTHON) -m uvicorn app.main:app --host $(HOST) --port $(PORT) --reload

frontend:
	@if [ ! -d "frontend/node_modules" ]; then \
		echo "Installing frontend dependencies..."; \
		(cd frontend && npm install); \
	fi
	@echo "======================================================="
	@echo "Starting Vite Frontend Dev Server..."
	@echo "UI URL: http://localhost:3000"
	@echo "Proxy:  http://localhost:3000/api -> http://$(HOST):$(PORT)"
	@echo "======================================================="
	cd frontend && npm run dev

build:
	@echo "Building frontend static assets into frontend/dist..."
	@if [ ! -d "frontend/node_modules" ]; then \
		echo "Installing frontend dependencies..."; \
		(cd frontend && npm install); \
	fi
	cd frontend && npm run build

run: venv
	@if [ ! -f "frontend/dist/index.html" ]; then \
		echo "Frontend dist not found, building..."; \
		$(MAKE) build; \
	fi
	@echo "======================================================="
	@echo "Starting Unified App on http://$(HOST):$(PORT)..."
	@echo "======================================================="
	$(PYTHON) -m uvicorn app.main:app --host $(HOST) --port $(PORT)

test: venv
	@echo "Running tests with pytest..."
	$(PYTEST) -v

clean:
	@echo "Cleaning up build artifacts and caches..."
	rm -rf __pycache__ .pytest_cache
	rm -rf app/__pycache__ app/*/__pycache__ src/*/__pycache__ tests/__pycache__
	rm -rf frontend/dist frontend/.vite
	@echo "Clean completed."
