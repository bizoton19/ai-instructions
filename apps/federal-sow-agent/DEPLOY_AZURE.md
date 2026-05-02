# Azure Deployment Plan (Dev + Prod)

This plan deploys the app to Azure Container Apps with Azure Database for PostgreSQL and Azure OpenAI.

## Target Architecture

- **Frontend**: React/Vite served from an Nginx container in Azure Container Apps
- **Backend**: FastAPI container in Azure Container Apps
- **Database**: Azure Database for PostgreSQL Flexible Server
- **Persistent files**: Azure Files share mounted into backend container (`/mnt/appdata`)
- **Secrets**: Azure Key Vault + Container App secrets
- **Model provider**: Existing Azure OpenAI resource/deployment
- **Images**: Azure Container Registry (ACR)

## What Was Added

- `infra/azure/main.bicep`
- `infra/azure/parameters/dev.bicepparam`
- `infra/azure/parameters/prod.bicepparam`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `frontend/.env.example` (`VITE_API_BASE`)
- Backend config update for dynamic CORS origins (`CORS_ALLOW_ORIGINS`)
- Frontend API base now configurable (`VITE_API_BASE`)

## Deployment Sequence

1. Create resource groups (`dev` and `prod`).
2. Build/push backend and frontend images to each environment ACR.
3. Deploy Bicep template with environment parameter file.
4. Capture backend URL output and update `viteApiBase` parameter if needed.
5. Rebuild frontend image with the final backend URL (`VITE_API_BASE`) and redeploy.
6. Validate `/health`, `/ready`, login flow, uploads, generation, export.
7. Add custom domains + certificates, then lock down network/security controls.

## Prerequisites

- Azure CLI + Bicep CLI installed
- Correct subscription selected (the one that owns your resource group), for example: `az account set --subscription <subscription-id>`
- Subscription access with permissions to deploy:
  - Container Apps
  - PostgreSQL Flexible Server
  - ACR
  - Key Vault
  - Storage
- Existing Azure OpenAI endpoint + deployment

## 1) Resource Groups

**Dev (example in use):** `agents-dev-rg` in **westus2**. Create it if it does not exist:

```bash
az group create -n agents-dev-rg -l westus2
```

**Prod:** use your production resource group and region (update `parameters/prod.bicepparam` accordingly).

```bash
# Example
az group create -n rg-sow-agent-prod -l westus2
```

## 2) Build and Push Images

Use your real ACR login server and tags from each `.bicepparam`.

```bash
# Example for dev backend (ACR name matches dev.bicepparam: agentsdevdevacr)
az acr login -n agentsdevdevacr
docker build -t agentsdevdevacr.azurecr.io/sow-backend:dev ./backend
docker push agentsdevdevacr.azurecr.io/sow-backend:dev

# Example for dev frontend (build-time API base)
docker build \
  --build-arg VITE_API_BASE=https://<dev-backend-fqdn> \
  -t agentsdevdevacr.azurecr.io/sow-frontend:dev \
  ./frontend
docker push agentsdevdevacr.azurecr.io/sow-frontend:dev
```

## 3) Deploy Infrastructure

```bash
cd infra/azure

# Dev (resource group agents-dev-rg, westus2)
az deployment group create \
  --resource-group agents-dev-rg \
  --template-file main.bicep \
  --parameters parameters/dev.bicepparam

# Prod
az deployment group create \
  --resource-group rg-sow-agent-prod \
  --template-file main.bicep \
  --parameters parameters/prod.bicepparam
```

## 4) Post-Deploy Validation

- Frontend URL opens
- Backend health endpoints:
  - `GET /health`
  - `GET /ready`
- Session login works
- Context/template upload persists across restarts
- Pipeline generation and exports work end to end

## Security and Hardening Follow-Ups

- Replace prototype dev login with Entra ID (OIDC)
- Move public ingress behind Front Door/WAF
- Restrict PostgreSQL and Key Vault network exposure
- Rotate all secrets and move away from direct parameterized secret values in files
- Configure diagnostic settings and alerting

