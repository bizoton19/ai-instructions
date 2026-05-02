using '../bootstrap-keyvault.bicep'

// Deploy into resource group: agents-dev-rg (region westus2)
param environment = 'dev'
param location = 'westus2'
param namePrefix = 'agentsdev'

// For strictly private model later, switch to Disabled and add private endpoints/DNS.
param keyVaultPublicNetworkAccess = 'Enabled'
