targetScope = 'resourceGroup'

@description('Deployment environment name.')
@allowed([
  'dev'
  'prod'
])
param environment string

@description('Azure region for Key Vault.')
param location string = resourceGroup().location

@description('Name prefix used across resources (letters/numbers only, <= 12 chars recommended).')
param namePrefix string

@description('Enable public network access for bootstrap simplicity. Set to Disabled for private endpoint model.')
@allowed([
  'Enabled'
  'Disabled'
])
param keyVaultPublicNetworkAccess string = 'Enabled'

var lowerPrefix = toLower(namePrefix)
var suffix = toLower(environment)
var keyVaultName = '${take(replace(lowerPrefix, '-', ''), 18)}-${suffix}-kv'

resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: keyVaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: keyVaultPublicNetworkAccess
  }
}

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
