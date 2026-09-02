# ZTMF UI Development Makefile

.PHONY: help install lint lint-fix format format-check build build-dev test dev clean

# Default target
help:
	@echo "Available commands:"
	@echo "  install      - Install dependencies"
	@echo "  lint         - Run linting checks"
	@echo "  lint-fix     - Run linting with auto-fix"
	@echo "  format       - Format code with Prettier"
	@echo "  format-check - Check if code is formatted"
	@echo "  build        - Build for production"
	@echo "  build-dev    - Build for development"
	@echo "  test         - Run tests"
	@echo "  dev          - Start development server"
	@echo "  clean        - Clean build artifacts"
	@echo "  check        - Run all checks (lint, format, build)"
	@echo "  pre-commit   - Run all pre-commit checks"
	@echo ""
	@echo "Accessibility (Frostfall):"
	@echo "  install-frostfall - Install the Frostfall scanner for this OS/arch"
	@echo "  frostfall         - Quick 508 scan against the running local dev stack"
	@echo "  frostfall-report  - Same scan, HTML report (frostfall-report.html)"
	@echo "  frostfall-ci      - Full isolated scan: Empire stack + own vite (what CI runs)"

# Install dependencies
install:
	@echo "Installing dependencies..."
	yarn install

# Linting
lint:
	@echo "Running linting checks..."
	yarn lint

lint-fix:
	@echo "Running linting with auto-fix..."
	yarn lint --fix

# Formatting
format:
	@echo "Formatting code with Prettier..."
	npx prettier --write .

format-check:
	@echo "Checking code formatting..."
	npx prettier --check .

# Building
build:
	@echo "Building for production..."
	yarn build

build-dev:
	@echo "Building for development..."
	yarn build:dev

# Testing
test:
	@echo "Running tests..."
	yarn test

# Development server
dev:
	@echo "Starting development server..."
	yarn dev

# Clean up
clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist
	rm -rf coverage
	rm -rf node_modules/.cache

# Combined checks
check: format-check lint build-dev
	@echo "All checks passed! ✅"

# Pre-commit hook
pre-commit: format lint
	@echo "Pre-commit checks completed! Ready to commit ✅"

# Quick development setup
setup: install
	@echo "Development environment setup complete! 🚀"
	@echo "Run 'make dev' to start the development server"

# --- Frostfall (axe-core accessibility scanner) install settings -------------
# Mirrors ../ztmf's install-emberfall: checksum-verified release binary into a
# user-writable bin dir. Override for a system-wide install, e.g.
# `make install-frostfall FROSTFALL_BIN_DIR=/usr/local/bin`.
FROSTFALL_VERSION ?= v1.4.1
FROSTFALL_OS := $(shell uname -s)
FROSTFALL_UNAME_M := $(shell uname -m)
FROSTFALL_ARCH := $(if $(filter arm64 aarch64,$(FROSTFALL_UNAME_M)),arm64,x86_64)
FROSTFALL_ASSET := frostfall_$(FROSTFALL_OS)_$(FROSTFALL_ARCH).tar.gz
FROSTFALL_URL := https://github.com/aquia-inc/frostfall/releases/download/$(FROSTFALL_VERSION)/$(FROSTFALL_ASSET)
FROSTFALL_CHECKSUMS_URL := https://github.com/aquia-inc/frostfall/releases/download/$(FROSTFALL_VERSION)/checksums.txt
FROSTFALL_BIN_DIR ?= $(HOME)/.local/bin

# Isolated backend stack (same one Emberfall's test-e2e uses): API on :8090,
# fresh DB every run, self-seeds via DB_POPULATE. NEVER compose-dev.yml.
COMPOSE_TEST := ../ztmf/backend/compose-test.yml

.PHONY: install-frostfall frostfall frostfall-report frostfall-local frostfall-ci

install-frostfall:
	@echo "Installing frostfall $(FROSTFALL_VERSION) for $(FROSTFALL_OS)/$(FROSTFALL_ARCH) -> $(FROSTFALL_BIN_DIR)..."
	@mkdir -p $(FROSTFALL_BIN_DIR)
	@curl -fsSL $(FROSTFALL_URL) -o /tmp/$(FROSTFALL_ASSET)
	@curl -fsSL $(FROSTFALL_CHECKSUMS_URL) -o /tmp/frostfall_checksums.txt
	@cd /tmp && grep " $(FROSTFALL_ASSET)$$" frostfall_checksums.txt | if command -v sha256sum >/dev/null 2>&1; then sha256sum -c -; else shasum -a 256 -c -; fi
	@tar -xzf /tmp/$(FROSTFALL_ASSET) -C $(FROSTFALL_BIN_DIR) frostfall
	@chmod +x $(FROSTFALL_BIN_DIR)/frostfall
	@rm -f /tmp/$(FROSTFALL_ASSET) /tmp/frostfall_checksums.txt
	@echo "frostfall $(FROSTFALL_VERSION) installed to $(FROSTFALL_BIN_DIR)/frostfall (sha256 verified)"
	@case ":$$PATH:" in *":$(FROSTFALL_BIN_DIR):"*) ;; *) echo "NOTE: $(FROSTFALL_BIN_DIR) is not on your PATH. Add it: export PATH=\"$(FROSTFALL_BIN_DIR):$$PATH\"" ;; esac

# Probe 5173-5177 for THIS app's vite dev server specifically. The vite marker
# (/@vite/client) alone is not enough - any other vite project parked on one of
# these ports would match it and get scanned silently - so also require the
# app's own <title> in the served index.
FROSTFALL_DETECT_PORT = PORT=""; for p in 5173 5174 5175 5176 5177; do \
		PAGE=$$(curl -s http://localhost:$$p/); \
		echo "$$PAGE" | grep -q "/@vite/client" && echo "$$PAGE" | grep -q "ZT Maturity Dashboard" \
			&& { PORT=$$p; break; }; done; \
	if [ -z "$$PORT" ]; then \
		echo "No ZTMF vite dev server answering on 5173-5177."; \
		echo "Start the stack first: 'make dev-up' and 'make frontend-env' in ../ztmf, then 'yarn dev' here."; \
		echo "For a reproducible scan with seeded data, use 'make frostfall-local' instead."; \
		exit 1; fi; \
	echo "Scanning http://localhost:$$PORT ..."

# Developer self-check against whatever dev stack is already running. Scans dev
# data, which is fine: every test in .frostfall.yml is data-agnostic. Baselines
# are NOT taken from this target - use frostfall-ci for anything reproducible.
# Vite auto-increments its port (5173-5177 depending on what else is running),
# so detect the live one and attach with --base-url rather than trusting the
# config's default.
frostfall:
	@if ! command -v frostfall >/dev/null 2>&1; then \
		echo "frostfall not installed. Run: make install-frostfall"; exit 1; fi
	@$(FROSTFALL_DETECT_PORT); \
	frostfall --screenshots --base-url http://localhost:$$PORT
	@echo "Done. Screenshots and per-test artifacts: ./frostfall-artifacts/"

frostfall-report:
	@if ! command -v frostfall >/dev/null 2>&1; then \
		echo "frostfall not installed. Run: make install-frostfall"; exit 1; fi
	@$(FROSTFALL_DETECT_PORT); \
	frostfall --screenshots --format html --base-url http://localhost:$$PORT
	@echo "Report: ./frostfall-report.html"

# The SARIF pass points --baseline at a file that does not exist, ON PURPOSE:
# baselined violations are omitted from SARIF, so honoring the baseline would
# upload zero alerts. For GitHub code scanning we want EVERY current violation
# as an open alert (that is the tracking dashboard); the baseline remains the
# regression gate for the text/html outputs only. Fixing a violation drops it
# from the next upload and its alert auto-closes.
# Isolated end-to-end scan, identical in spirit to ../ztmf's test-e2e: fresh
# Empire-seeded stack on :8090, our own vite on :5174 pointed at it, scan,
# tear everything down. Requires :5174 to be FREE - a running dev server would
# make vite pick another port and the scan would silently hit dev data.
#
# This is THE repeatable local runbook, not just the CI entrypoint: seeded data
# means the findings match the committed baseline exactly, run after run, on
# any machine with the backend repo cloned alongside. The dev-attach targets
# above are for eyeballing whatever dev data happens to be up; their counts
# drift with row counts and are never comparable across machines.
frostfall-local: frostfall-ci

frostfall-ci:
	@if ! command -v frostfall >/dev/null 2>&1; then \
		echo "frostfall not installed. Run: make install-frostfall"; exit 1; fi
	@if [ ! -f $(COMPOSE_TEST) ]; then \
		echo "Backend repo not found ($(COMPOSE_TEST) missing)."; \
		echo "Clone CMS-Enterprise/ztmf as a sibling of this repo."; \
		exit 1; fi
	@if curl -s -o /dev/null http://localhost:5174; then \
		echo "Port 5174 is already in use (dev server running?). Stop it first:"; \
		echo "the isolated scan must not attach to a dev-data server."; \
		exit 1; fi
	@bash -euo pipefail -c ' \
		cleanup() { \
			if [ -n "$${VITE_PID:-}" ]; then kill "$$VITE_PID" 2>/dev/null || true; fi; \
			if [ -n "$${CONFIG_BAK:-}" ]; then mv "$$CONFIG_BAK" public/config.js; \
			elif [ -n "$${CONFIG_WRITTEN:-}" ]; then rm -f public/config.js; fi; \
			docker compose -f $(COMPOSE_TEST) down -v >/dev/null 2>&1 || true; \
		}; \
		trap cleanup EXIT; \
		echo "Cleaning up any existing test containers..."; \
		docker compose -f $(COMPOSE_TEST) down -v 2>/dev/null || true; \
		echo "Starting isolated test stack (API :8090, fresh DB)..."; \
		docker compose -f $(COMPOSE_TEST) up -d --build; \
		echo "Waiting for the API..."; \
		for i in $$(seq 1 60); do \
			curl -s -o /dev/null http://localhost:8090 && break; \
			[ "$$i" = 60 ] && { echo "API never came up on :8090"; exit 1; }; \
			sleep 1; \
		done; \
		HEADER=$$(printf %s "{\"alg\":\"HS256\"}" | openssl base64 -A | tr "+/" "-_" | tr -d "="); \
		PAYLOAD=$$(printf %s "{\"email\":\"Test.User@nowhere.xyz\"}" | openssl base64 -A | tr "+/" "-_" | tr -d "="); \
		SIG=$$(printf %s "$$HEADER.$$PAYLOAD" | openssl dgst -sha256 -hmac zeroTrust -binary | openssl base64 -A | tr "+/" "-_" | tr -d "="); \
		JWT="$$HEADER.$$PAYLOAD.$$SIG"; \
		if [ -f public/config.js ]; then CONFIG_BAK=$$(mktemp); cp public/config.js "$$CONFIG_BAK"; fi; \
		echo "window.ZTMF_RUNTIME_CONFIG = { authToken: \"$$JWT\" }" > public/config.js; \
		CONFIG_WRITTEN=1; \
		echo "Starting vite against the isolated API..."; \
		VITE_CF_DOMAIN=http://localhost:8090 \
			./node_modules/.bin/vite --port 5174 --strictPort >/tmp/frostfall-vite.log 2>&1 & \
		VITE_PID=$$!; \
		echo "Waiting for vite on :5174..."; \
		for i in $$(seq 1 60); do \
			curl -s -o /dev/null http://localhost:5174 && break; \
			[ "$$i" = 60 ] && { echo "vite never came up on :5174:"; cat /tmp/frostfall-vite.log || true; exit 1; }; \
			sleep 1; \
		done; \
		frostfall --screenshots --format html "$$@"; \
		echo "Report: ./frostfall-report.html"; \
		frostfall --format sarif --output frostfall.sarif --baseline .frostfall-no-baseline.json; \
		echo "SARIF (all violations, baseline ignored): ./frostfall.sarif"; \
	' frostfall-ci $(FROSTFALL_ARGS)
