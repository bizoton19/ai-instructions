using '../main.bicep'

// Deploy into resource group: agents-dev-rg (region westus2)
// az deployment group create -g agents-dev-rg --template-file main.bicep --parameters parameters/dev.bicepparam

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

param backendCpu = 1
param backendMemory = '2Gi'
param frontendCpu = 1
param frontendMemory = '2Gi'

param viteApiBase = 'https://agentsdev-dev-api.mangobay-9fefd7e8.westus2.azurecontainerapps.io'
