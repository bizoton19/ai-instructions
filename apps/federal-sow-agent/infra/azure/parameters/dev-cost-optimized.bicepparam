using '../main.bicep'

// =============================================================================
// COST-OPTIMIZED DEV PARAMETERS - Target: Stay under $150/month Azure credits
// =============================================================================
// These settings optimize for dev/test environments with $150/month Azure credits.
// Key optimizations:
// - Container Apps: scale to zero (minReplicas=0), 0.5 vCPU, 1Gi memory
// - PostgreSQL: Burstable B1ms tier (1 core), 32GB storage (vs B2s/64GB)
// - No geo-redundant backup in dev
// =============================================================================

param environment = 'dev'
param location = 'westus2'
param postgresLocation = 'centralus'  // Separate region only if quota requires

// Short alphanumeric prefix; Bicep creates ACR named {namePrefix}{environment}acr
param namePrefix = 'agentsdev'

param backendImage = 'agentsdevdevacr.azurecr.io/sow-backend:dev'
param frontendImage = 'agentsdevdevacr.azurecr.io/sow-frontend:dev'

param azureOpenAiEndpoint = 'https://cpsc-chatbot.openai.azure.com/'
param azureOpenAiResourceName = 'cpsc-chatbot'
param azureOpenAiResourceGroup = 'rg-ml-shared'
param azureOpenAiDeployment = 'gpt-4o-mini-recalls'
param azureOpenAiApiKey = '<set-secure-value>'

param appSecretKey = '<set-secure-value>'
param devLoginEmail = 'dev@example.gov'
param devLoginPassword = '<set-secure-value>'

param postgresAdminUser = 'sowadmin'
param postgresAdminPassword = '<set-secure-value>'
param postgresDatabaseName = 'sow_agent'

// =============================================================================
// CONTAINER APPS - COST OPTIMIZED
// 0.5 vCPU + 1Gi is valid combo for Consumption tier
// minReplicas=0 is the BIGGEST cost savings - scales to zero when idle
// =============================================================================

param backendCpu = 0.5           // Reduced from 1.0 (50% savings on compute)
param backendMemory = '1Gi'    // Reduced from 2Gi (50% savings on memory)
param frontendCpu = 0.5        // Reduced from 1.0
param frontendMemory = '1Gi'   // Reduced from 2Gi
param containerAppsMinReplicas = 0  // SCALE TO ZERO - biggest cost saver!

// =============================================================================
// POSTGRESQL - COST OPTIMIZED
// B1ms = 1 core burstable, ~40% cheaper than B2s
// 32GB storage instead of 64GB
// =============================================================================

param postgresSkuName = 'Standard_B1ms'  // 1 core instead of 2
param postgresStorageGb = 32            // 32GB instead of 64GB

param viteApiBase = 'https://agentsdev-dev-api.mangobay-9fefd7e8.westus2.azurecontainerapps.io'

// =============================================================================
// ESTIMATED MONTHLY COSTS (West US 2, approximate, for reference only):
// =============================================================================
// 
// BEFORE optimization (original dev.bicepparam):
// - Container Apps (2× 1vCPU/2Gi, minReplicas=1): ~$60-80/month always-on
// - PostgreSQL B2s + 64GB: ~$45-55/month
// - ACR Basic: ~$5/month
// - Storage + Log Analytics: ~$10-20/month
// - Key Vault: ~$0.10/month
// TOTAL: ~$120-160/month (can exceed $150 with OpenAI usage)
//
// AFTER optimization (this file):
// - Container Apps (2× 0.5vCPU/1Gi, minReplicas=0): ~$5-20/month (scales to zero!)
// - PostgreSQL B1ms + 32GB: ~$25-30/month
// - ACR Basic: ~$5/month
// - Storage + Log Analytics: ~$10-15/month
// - Key Vault: ~$0.10/month
// TOTAL: ~$45-70/month + OpenAI usage
//
// SAVINGS: ~$75-90/month (50-60% reduction)
//
// NOTE: OpenAI usage is variable - monitor via Azure Cost Management
// Actual costs depend on usage patterns and may vary by region
// Use Azure Pricing Calculator for exact estimates: https://azure.microsoft.com/pricing/calculator/
// =============================================================================

// =============================================================================
// DEPLOYMENT COMMAND:
// =============================================================================
// az deployment group create \
//   -g agents-dev-rg \
//   --template-file infra/azure/main.bicep \
//   --parameters infra/azure/parameters/dev-cost-optimized.bicepparam
// =============================================================================
