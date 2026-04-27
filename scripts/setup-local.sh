#!/usr/bin/env bash
set -euo pipefail

echo "==> Checking dependencies..."
for cmd in kind kubectl helm; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: $cmd not found. Please install it first."
    exit 1
  fi
done

CLUSTER_NAME="wingert-local"

echo "==> Creating kind cluster: $CLUSTER_NAME"
if kind get clusters | grep -q "^$CLUSTER_NAME$"; then
  echo "Cluster already exists, skipping."
else
  kind create cluster --name "$CLUSTER_NAME" --config - <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "ingress-ready=true"
    extraPortMappings:
      - containerPort: 80
        hostPort: 80
        protocol: TCP
      - containerPort: 443
        hostPort: 443
        protocol: TCP
EOF
fi

echo "==> Setting kubectl context"
kubectl cluster-info --context "kind-$CLUSTER_NAME"

echo "==> Installing ingress-nginx"
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s

echo "==> Setup complete. Run 'task dev' to start."
