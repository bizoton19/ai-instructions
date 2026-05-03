using '../main.bicep'

// =============================================================================
// STANDARD DEV PARAMETERS
// =============================================================================
// For cost-optimized settings (scale-to-zero, smaller SKUs), see:
//   infra/azure/parameters/dev-cost-optimized.bicepparam
//
// Deploy into resource group: agents-dev-rg (region westus2)
// az deployment group create -g agents-dev-rg --template-file main.bicep --parameters parameters/dev.bicepparam
// =============================================================================

param environment = 'dev'
param location = 'westus2'
param postgresLocation = 'centralus'

// Short alphanumeric prefix; Bicep creates ACR named {namePrefix}{environment}acr → agentsdevdevacr
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

// Container Apps sizing
// Standard: 1 vCPU / 2Gi per app
// Cost-optimized: 0.5 vCPU / 1Gi, minReplicas=0 (see dev-cost-optimized.bicepparam)
param backendCpu = 1
param backendMemory = '2Gi'
param frontendCpu = 1
param frontendMemory = '2Gi'

// Container Apps scale settings
// Set to 0 for cost-optimized dev (scales to zero when idle)
// Default 1 ensures always-on (faster response but higher cost)
// param containerAppsMinReplicas = 1  // Uncomment to override default

// PostgreSQL SKU - defaults to Standard_B2s in main.bicep
// For cost optimization, use Standard_B1ms (1 core instead of 2)
// param postgresSkuName = 'Standard_B2s'  // Uncomment to override

// PostgreSQL storage - defaults to 64GB in main.bicep
// For cost optimization, use 32GB
// param postgresStorageGb = 64  // Uncomment to override

param viteApiBase = 'https://agentsdev-dev-api.mangobay-9fefd7e8.westus2.azurecontainerapps.io'
