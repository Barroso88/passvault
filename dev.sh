#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "Installing frontend dependencies..."
  npm install --prefix "$FRONTEND_DIR"
fi

if command -v docker >/dev/null 2>&1; then
  if [[ ! -d "$BACKEND_DIR/node_modules" ]]; then
    echo "Installing backend dependencies..."
    npm install --prefix "$BACKEND_DIR"
  fi

  echo "Starting PostgreSQL container on http://localhost:5432"
  docker compose up -d postgres

  export DATABASE_URL="postgres://passvault_user:passvault_secret@localhost:5432/passvault"

  echo "Waiting for PostgreSQL to be ready..."
  for _ in {1..30}; do
    if docker compose exec -T postgres pg_isready -U passvault_user -d passvault >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  echo "Starting backend on http://localhost:3001"
  (
    cd "$BACKEND_DIR"
    DATABASE_URL="$DATABASE_URL" node server.js
  ) &
  BACKEND_PID=$!

  echo "Starting frontend on http://localhost:5173"
  (
    cd "$FRONTEND_DIR"
    VITE_API_URL="http://localhost:3001/api" npm run dev
  ) &
  FRONTEND_PID=$!
else
  echo "Docker not found. Starting frontend in preview mode only."
  echo "You will be able to inspect the UI, but the real backend will not run on this machine."
  (
    cd "$FRONTEND_DIR"
    VITE_PREVIEW_MODE="true" npm run dev
  ) &
  FRONTEND_PID=$!
fi

wait
