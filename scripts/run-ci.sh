#!/usr/bin/env bash
set -euo pipefail

# Lokales CI-Script – führt dieselbe Pipeline wie GitHub Actions aus,
# ohne dass eingecheckt werden muss.

PASS=0
FAIL=0
ERRORS=()

run_step() {
  local name="$1"
  shift
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "▶  $name"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  if "$@"; then
    echo "✓  $name"
    ((PASS++)) || true
  else
    echo "✗  $name FAILED"
    ERRORS+=("$name")
    ((FAIL++)) || true
  fi
}

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ── Backend ──────────────────────────────────────────────
run_step "Backend: go vet" \
  bash -c "cd apps/backend && go vet ./..."

run_step "Backend: go build" \
  bash -c "cd apps/backend && go build ./..."

run_step "Backend: tests" \
  bash -c "cd apps/backend && \
    DOCKER_HOST=unix://$HOME/.docker/run/docker.sock \
    DOCKER_AUTH_CONFIG='{}' \
    TESTCONTAINERS_RYUK_DISABLED=true \
    go test ./... -timeout 300s"

# ── Frontend ─────────────────────────────────────────────
run_step "Frontend: install" \
  bash -c "cd apps/frontend && pnpm install --frozen-lockfile"

run_step "Frontend: lint" \
  bash -c "cd apps/frontend && pnpm lint" || true  # lint als Warnung, nicht als Blocker

run_step "Frontend: tests" \
  bash -c "cd apps/frontend && pnpm test --run"

run_step "Frontend: build" \
  bash -c "cd apps/frontend && pnpm build"

# ── Helm ─────────────────────────────────────────────────
if command -v helm &>/dev/null; then
  run_step "Helm: lint" \
    helm lint charts/wingert

  run_step "Helm: template dry-run" \
    bash -c "helm template wingert charts/wingert > /dev/null"
else
  echo "⚠  helm not found, skipping chart validation"
fi

# ── Summary ──────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CI Summary: $PASS passed, $FAIL failed"
if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "  Failed steps:"
  for e in "${ERRORS[@]}"; do
    echo "    ✗ $e"
  done
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  All checks passed ✓"
