#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-wingert}"

echo "==> Starting port-forwards (Ctrl+C to stop)..."
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8080"
echo "  Postgres: localhost:5432"

kubectl port-forward -n "$NAMESPACE" svc/wingert-wingert-frontend 3000:80 &
kubectl port-forward -n "$NAMESPACE" svc/wingert-wingert-backend 8080:8080 &
kubectl port-forward -n "$NAMESPACE" svc/wingert-wingert-postgres 5432:5432 &

wait
