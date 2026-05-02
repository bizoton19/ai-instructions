using '../main.bicep'

param environment = 'prod'
param location = 'eastus2'
param namePrefix = 'sowagent'

param backendImage = 'sowagentprodacr.azurecr.io/sow-backend:prod'
param frontendImage = 'sowagentprodacr.azurecr.io/sow-frontend:prod'

param azureOpenAiEndpoint = 'https://<your-aoai-resource>.openai.azure.com/'
param azureOpenAiResourceName = '<your-aoai-resource-name>'
param azureOpenAiResourceGroup = '<your-aoai-resource-group>'
param azureOpenAiDeployment = 'gpt-4o'
param azureOpenAiApiKey = '<set-secure-value>'

param appSecretKey = '<set-secure-value>'
param devLoginEmail = 'dev@example.gov'
param devLoginPassword = '<set-secure-value>'

param postgresAdminUser = 'sowadmin'
param postgresAdminPassword = '<set-secure-value>'
param postgresDatabaseName = 'sow_agent'

param backendCpu = 2
param backendMemory = '4Gi'
param frontendCpu = 1
param frontendMemory = '2Gi'

param viteApiBase = 'https://<prod-backend-fqdn>'
