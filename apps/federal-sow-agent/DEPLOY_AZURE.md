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
- **Identity**: System-assigned managed identity for Container Apps wherever Azure supports it

## What Was Added

- `infra/azure/main.bicep`
- `infra/azure/bootstrap-keyvault.bicep` (deploy Key Vault first)
- `infra/azure/parameters/dev.bicepparam`
- `infra/azure/parameters/prod.bicepparam`
- `infra/azure/parameters/dev-keyvault.bicepparam`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `frontend/.env.example` (`VITE_API_BASE`)
- Backend config update for dynamic CORS origins (`CORS_ALLOW_ORIGINS`)
- Frontend API base now configurable (`VITE_API_BASE`)

## Deployment Sequence

1. Create resource groups (`dev` and `prod`).
2. Bootstrap Key Vault first and seed secrets.
3. Create identity primitives:
   - GitHub Actions deployment app registration + federated credential.
   - Entra app registration for app login.
   - Default access group: `app-wagent-default`.
4. Create ACR and build/push backend and frontend images.
5. Deploy Bicep template with environment parameter file and Key Vault-backed secret values.
6. Capture backend/frontend URLs.
7. Update Entra login redirect URI after the backend URL is known.
8. Rebuild frontend with the final backend URL (`VITE_API_BASE`) and redeploy.
9. Validate `/health`, `/ready`, login flow, uploads, generation, export.
10. Add custom domains + certificates, then lock down network/security controls.

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

**Dev (example in use):** `agents-dev-rg` in **westus2**. Create it if it does not exist. App resources deploy in `westus2`; PostgreSQL deploys in `eastus` because this subscription is currently restricted from provisioning PostgreSQL Flexible Server in some western regions.

```bash
az group create -n agents-dev-rg -l westus2
```

**Prod:** use your production resource group and region (update `parameters/prod.bicepparam` accordingly).

```bash
# Example
az group create -n rg-sow-agent-prod -l westus2
```

## 2) Bootstrap Key Vault First (Recommended)

Deploy only Key Vault first:

```bash
cd infra/azure
az deployment group create \
  --resource-group agents-dev-rg \
  --template-file bootstrap-keyvault.bicep \
  --parameters parameters/dev-keyvault.bicepparam
```

Seed required secrets in Key Vault:

```bash
az keyvault secret set --vault-name agentsdev-dev-kv --name app-secret-key --value "<secret>"
az keyvault secret set --vault-name agentsdev-dev-kv --name azure-openai-api-key --value "<aoai-key>"
az keyvault secret set --vault-name agentsdev-dev-kv --name dev-login-password --value "<dev-password>"
az keyvault secret set --vault-name agentsdev-dev-kv --name postgres-admin-password --value "<postgres-password>"
```

## 3) Identity Bootstrap

For this dev environment, create these identity resources before application deployment:

- **Default user access group:** `app-wagent-default`
- **GitHub Actions deploy app registration:** `agentsdev-github-actions`
- **GitHub Actions OIDC federated credential:** subject `repo:bizoton19/ai-instructions:ref:refs/heads/main`
- **Application login app registration:** `agentsdev-app-login`

The GitHub Actions app registration should be assigned enough rights on `agents-dev-rg` to deploy Bicep. Because `main.bicep` creates role assignments for Container Apps to pull from ACR, the deploy identity needs role-assignment capability, not just Contributor.

For dev, the current setup grants:

- `Contributor` on `agents-dev-rg`
- `User Access Administrator` on `agents-dev-rg`

For production, prefer a narrower custom role if your security team requires least privilege.

Store identity IDs in Key Vault so CI/CD and app configuration can reference them:

```bash
az keyvault secret set --vault-name agentsdev-dev-kv --name entra-tenant-id --value "<tenant-id>"
az keyvault secret set --vault-name agentsdev-dev-kv --name entra-default-group-id --value "<group-object-id>"
az keyvault secret set --vault-name agentsdev-dev-kv --name github-actions-client-id --value "<github-actions-app-client-id>"
az keyvault secret set --vault-name agentsdev-dev-kv --name entra-login-client-id --value "<app-login-client-id>"
```

## Managed Identity Access Model

Use managed identity by default, and only fall back to static secrets where the service requires extra bootstrapping.

### Backend Container App Identity

The backend Container App uses a **system-assigned managed identity**. The Bicep grants it:

- **ACR Pull** on the app ACR, so the backend can pull images without registry passwords.
- **Key Vault Secrets User** on `agentsdev-dev-kv`, so the Python API can read secrets directly from Key Vault if needed.
- **Cognitive Services OpenAI User** on the existing Azure OpenAI resource (`cpsc-chatbot` in `rg-ml-shared`) when `azureOpenAiResourceName` and `azureOpenAiResourceGroup` are provided.

The Python API now supports Azure OpenAI managed identity. If `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_DEPLOYMENT` are set but `AZURE_OPENAI_API_KEY` is omitted, the app uses `DefaultAzureCredential` and the Container App managed identity.

### Frontend Container App Identity

The frontend Container App also uses a **system-assigned managed identity** and receives:

- **ACR Pull** on the app ACR.

The frontend is static Nginx content and does not need Key Vault or database access.

### PostgreSQL Managed Identity Access

Azure Database for PostgreSQL Flexible Server can use Entra authentication, but it is not a simple ARM RBAC grant. It needs:

1. PostgreSQL Flexible Server with Entra authentication/admin configured.
2. A database principal created for the backend managed identity.
3. SQL privileges granted to that principal.
4. Python database connection code that requests an Entra access token and uses it as the PostgreSQL password.

Until those steps are complete, the app can use the generated `postgres-admin-password` from Key Vault as a bootstrap path.

After the backend Container App exists, get its principal ID:

```bash
BACKEND_PRINCIPAL_ID=$(az containerapp identity show \
  --resource-group agents-dev-rg \
  --name agentsdev-dev-api \
  --query principalId -o tsv)
```

Configure a PostgreSQL Entra admin (example uses your signed-in user as admin):

```bash
SIGNED_IN_OBJECT_ID=$(az ad signed-in-user show --query id -o tsv)
SIGNED_IN_UPN=$(az ad signed-in-user show --query userPrincipalName -o tsv)

az postgres flexible-server ad-admin create \
  --resource-group agents-dev-rg \
  --server-name agentsdev-dev-pgsql \
  --display-name "$SIGNED_IN_UPN" \
  --object-id "$SIGNED_IN_OBJECT_ID" \
  --type User
```

Then connect to PostgreSQL as the Entra admin and create/grant the backend managed identity principal:

```bash
PGTOKEN=$(az account get-access-token \
  --resource-type oss-rdbms \
  --query accessToken -o tsv)

PGPASSWORD="$PGTOKEN" psql \
  "host=agentsdev-dev-pgsql.postgres.database.azure.com port=5432 dbname=sow_agent user=$SIGNED_IN_UPN sslmode=require"
```

Inside `psql`:

```sql
select * from pgaadauth_create_principal('agentsdev-dev-api', false, false);
grant connect on database sow_agent to "agentsdev-dev-api";
grant usage, create on schema public to "agentsdev-dev-api";
grant select, insert, update, delete on all tables in schema public to "agentsdev-dev-api";
alter default privileges in schema public grant select, insert, update, delete on tables to "agentsdev-dev-api";
```

After that, update the Python API database connection to use Entra token auth for PostgreSQL before removing the password-based `DATABASE_URL`.

### App Login Redirect URI

The application login registration can be created before the app is deployed, but the real callback URL should be updated after Container Apps returns the backend FQDN.

Recommended backend callback shape:

```text
https://<backend-container-app-fqdn>/auth/callback
```

Current local development callback:

```text
http://localhost:8000/auth/callback
```

After app deployment:

```bash
az ad app update \
  --id "$(az keyvault secret show --vault-name agentsdev-dev-kv --name entra-login-client-id --query value -o tsv)" \
  --web-redirect-uris "http://localhost:8000/auth/callback" "https://<backend-container-app-fqdn>/auth/callback"
```

## 4) Build and Push Images

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

## 5) Deploy Infrastructure

```bash
cd infra/azure

# Dev (resource group agents-dev-rg, westus2)
az deployment group create \
  --resource-group agents-dev-rg \
  --template-file main.bicep \
  --parameters parameters/dev.bicepparam \
  --parameters \
    postgresAdminPassword="$(az keyvault secret show --vault-name agentsdev-dev-kv --name postgres-admin-password --query value -o tsv)" \
    appSecretKey="$(az keyvault secret show --vault-name agentsdev-dev-kv --name app-secret-key --query value -o tsv)" \
    azureOpenAiApiKey="$(az keyvault secret show --vault-name agentsdev-dev-kv --name azure-openai-api-key --query value -o tsv)" \
    devLoginPassword="$(az keyvault secret show --vault-name agentsdev-dev-kv --name dev-login-password --query value -o tsv)"
```

If using inline params instead of `.bicepparam`, include:

```bash
postgresLocation=eastus frontendCpu=1 frontendMemory=2Gi
```

```bash
# Prod
az deployment group create \
  --resource-group rg-sow-agent-prod \
  --template-file main.bicep \
  --parameters parameters/prod.bicepparam
```

## 6) Post-Deploy Validation

- Frontend URL opens
- Backend health endpoints:
  - `GET /health`
  - `GET /ready`
- Session login works
- Context/template upload persists across restarts
- Pipeline generation and exports work end to end

## Security and Hardening Follow-Ups

- Replace prototype dev login with Entra ID (OIDC)
- Use `app-wagent-default` as the default allowlisted group for app access.
- Move public ingress behind Front Door/WAF
- Restrict PostgreSQL and Key Vault network exposure
- Rotate all secrets and move away from direct parameterized secret values in files
- Configure diagnostic settings and alerting

## Recommended Deployment Pattern for Similar Agent Apps

Use this sequence for apps with similar needs: private source docs, LLM secrets, generated files, database state, CI/CD, and internal Entra login.

1. **Resource group and naming:** Create one resource group per environment (`dev`, `test`, `prod`) and use a short stable prefix.
2. **Key Vault first:** Deploy Key Vault before anything else. Seed application secrets, model keys, database passwords, tenant IDs, client IDs, and default group IDs.
3. **Identity second:** Create CI/CD workload identity with GitHub OIDC, then create app login registration and default access group. Store IDs in Key Vault.
4. **Network foundation:** Create VNet/subnets/private DNS/private endpoints if the app is private-only. Decide internal vs external Container Apps ingress before app deploy.
5. **Container registry:** Create ACR, assign CI/CD push permissions, and build initial images.
6. **State services:** Deploy PostgreSQL Flexible Server, Storage/Azure Files, Log Analytics, and any private endpoints.
7. **Container Apps environment:** Deploy one managed environment per stage and connect it to logs/networking.
8. **Backend first:** Deploy backend Container App with secrets, database connection, storage mount, and health checks.
9. **Managed identity grants:** Grant the backend identity Key Vault, Azure OpenAI, ACR, and PostgreSQL access. PostgreSQL requires SQL-level principal creation in addition to Azure configuration.
10. **Finalize identity callbacks:** Update Entra redirect URIs using the deployed backend URL.
11. **Frontend second:** Build frontend with the real API base URL, push image, and deploy frontend Container App.
12. **Validation:** Test health, auth, upload, generation, document export, restart persistence, and logs.
13. **Production hardening:** Add custom domains, WAF/Front Door or private ingress, monitoring alerts, secret rotation, backup policy, and release gates.

