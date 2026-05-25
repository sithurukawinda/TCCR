# CMP Kubernetes Manifests

Each service has its own directory with three files:
- `deployment.yaml` — Deployment + liveness/readiness probes
- `service.yaml` — ClusterIP Service
- `hpa.yaml` — HorizontalPodAutoscaler (min 2 / max 10 / CPU 70%)

## Apply all

```bash
# Staging
kubectl apply -f k8s/staging/ --namespace cmp-staging

# Production
kubectl apply -f k8s/production/ --namespace cmp-production
```

## Secrets

All env vars are injected from a Kubernetes Secret named `cmp-secrets` in each namespace.
Create it once per namespace:

```bash
kubectl create secret generic cmp-secrets \
  --from-env-file=.env.local \
  --namespace cmp-staging
```

## Ingress

The Gateway service is exposed via an Ingress that routes `/api/v1/*` to the gateway service on port 3000.
TLS is terminated at the Ingress controller level.
