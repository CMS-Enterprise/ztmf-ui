# ZTMF UI Development Makefile

# Auto-detect env from current git branch.
# impl / feature/impl-* -> impl; everything else -> main.
# Override on command line: make dev ZTMF_ENV=impl
ZTMF_ENV ?= $(shell git branch --show-current 2>/dev/null | grep -qE '^(impl|feature/impl-)' && echo impl || echo main)
-include Makefile.$(ZTMF_ENV)

# Defaults (overridden by Makefile.impl when ZTMF_ENV=impl)
FRONTEND_PORT ?= 5174
export VITE_DEV_PORT = $(FRONTEND_PORT)

.PHONY: help install lint lint-fix format format-check build build-dev test dev clean env

# Default target
help:
	@echo "Active env: $(ZTMF_ENV) (frontend port $(FRONTEND_PORT))"
	@echo ""
	@echo "Available commands:"
	@echo "  env          - Show resolved env variables"
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
	@echo "Starting development server ($(ZTMF_ENV)) on port $(FRONTEND_PORT)..."
	VITE_DEV_PORT=$(FRONTEND_PORT) yarn dev

# Show resolved env
env:
	@echo "ZTMF_ENV       = $(ZTMF_ENV)"
	@echo "FRONTEND_PORT  = $(FRONTEND_PORT)"
	@echo "VITE_DEV_PORT  = $(VITE_DEV_PORT)"

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