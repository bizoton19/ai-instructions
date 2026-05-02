targetScope = 'resourceGroup'

@description('Deployment environment name.')
@allowed([
  'dev'
  'prod'
])
param environment string

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Azure region for PostgreSQL Flexible Server. Keep separate because Postgres quota can be restricted by region.')
param postgresLocation string = location

@description('Name prefix used across resources (letters/numbers only, <= 12 chars recommended).')
param namePrefix string

@description('Backend container image in ACR format, for example: myacr.azurecr.io/sow-backend:1.0.0')
param backendImage string

@description('Frontend container image in ACR format, for example: myacr.azurecr.io/sow-frontend:1.0.0')
param frontendImage string

@description('Azure OpenAI endpoint URL.')
param azureOpenAiEndpoint string

@description('Existing Azure OpenAI resource name. Set to grant backend managed identity Azure OpenAI RBAC.')
param azureOpenAiResourceName string = ''

@description('Resource group containing the existing Azure OpenAI resource.')
param azureOpenAiResourceGroup string = resourceGroup().name

@description('Azure OpenAI deployment name used by the app.')
param azureOpenAiDeployment string

@secure()
@description('Azure OpenAI API key.')
param azureOpenAiApiKey string

@secure()
@description('Application secret key used for session signing.')
param appSecretKey string

@description('Dev login email for internal prototype login.')
param devLoginEmail string = 'dev@example.gov'

@secure()
@description('Dev login password for internal prototype login.')
param devLoginPassword string

@secure()
@description('PostgreSQL admin password.')
param postgresAdminPassword string

@description('PostgreSQL admin username.')
param postgresAdminUser string = 'sowadmin'

@description('PostgreSQL database name for the app.')
param postgresDatabaseName string = 'sow_agent'

@description('CPU cores for backend container app.')
param backendCpu int = 1

@description('Memory for backend container app.')
param backendMemory string = '2Gi'

@description('CPU cores for frontend container app.')
param frontendCpu int = 1

@description('Memory for frontend container app.')
param frontendMemory string = '1Gi'

@description('Vite API base URL used at frontend image build time. Keep this aligned with backend URL for each environment.')
param viteApiBase string

var lowerPrefix = toLower(namePrefix)
var suffix = toLower(environment)

var acrName = '${take(replace(lowerPrefix, '-', ''), 20)}${suffix}acr'
var storageName = '${take(replace(lowerPrefix, '-', ''), 18)}${suffix}st'
var keyVaultName = '${take(replace(lowerPrefix, '-', ''), 18)}-${suffix}-kv'
var logAnalyticsName = '${namePrefix}-${suffix}-log'
var managedEnvName = '${namePrefix}-${suffix}-cae'
var backendAppName = '${namePrefix}-${suffix}-api'
var frontendAppName = '${namePrefix}-${suffix}-web'
var postgresServerName = '${take(replace(lowerPrefix, '-', ''), 30)}-${suffix}-pg-${take(uniqueString(postgresLocation), 4)}'
var fileShareName = 'appdata'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

resource share 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-05-01' = {
  name: '${storage.name}/default/${fileShareName}'
  properties: {
    accessTier: 'TransactionOptimized'
    shareQuota: 100
  }
}

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
    publicNetworkAccess: 'Enabled'
  }
}

resource kvSecretApp 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'app-secret-key'
  properties: {
    value: appSecretKey
  }
}

resource kvSecretOpenAi 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'azure-openai-api-key'
  properties: {
    value: azureOpenAiApiKey
  }
}

resource kvSecretDevPassword 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'dev-login-password'
  properties: {
    value: devLoginPassword
  }
}

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: postgresServerName
  location: postgresLocation
  sku: {
    name: environment == 'prod' ? 'Standard_D4s_v3' : 'Standard_B2s'
    tier: environment == 'prod' ? 'GeneralPurpose' : 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: postgresAdminUser
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: environment == 'prod' ? 128 : 64
    }
    backup: {
      backupRetentionDays: environment == 'prod' ? 14 : 7
      geoRedundantBackup: environment == 'prod' ? 'Enabled' : 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
  }
}

resource postgresDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: postgresServer
  name: postgresDatabaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

resource postgresFirewallAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = {
  parent: postgresServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource managedEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: managedEnvName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: listKeys(logAnalytics.id, logAnalytics.apiVersion).primarySharedKey
      }
    }
  }
}

resource managedEnvStorage 'Microsoft.App/managedEnvironments/storages@2024-03-01' = {
  parent: managedEnv
  name: 'appdata'
  properties: {
    azureFile: {
      accessMode: 'ReadWrite'
      accountName: storage.name
      accountKey: listKeys(storage.id, storage.apiVersion).keys[0].value
      shareName: fileShareName
    }
  }
  dependsOn: [
    share
  ]
}

resource backendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: backendAppName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: managedEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          identity: 'system'
        }
      ]
      secrets: [
        {
          name: 'app-secret-key'
          value: appSecretKey
        }
        {
          name: 'azure-openai-api-key'
          value: azureOpenAiApiKey
        }
        {
          name: 'dev-login-password'
          value: devLoginPassword
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: backendImage
          resources: {
            cpu: backendCpu
            memory: backendMemory
          }
          env: [
            {
              name: 'DATABASE_URL'
              value: 'postgresql+psycopg2://${postgresAdminUser}:${postgresAdminPassword}@${postgresServer.properties.fullyQualifiedDomainName}:5432/${postgresDatabaseName}?sslmode=require'
            }
            {
              name: 'SECRET_KEY'
              secretRef: 'app-secret-key'
            }
            {
              name: 'AZURE_OPENAI_ENDPOINT'
              value: azureOpenAiEndpoint
            }
            {
              name: 'AZURE_OPENAI_API_KEY'
              secretRef: 'azure-openai-api-key'
            }
            {
              name: 'AZURE_OPENAI_DEPLOYMENT'
              value: azureOpenAiDeployment
            }
            {
              name: 'DEV_LOGIN_EMAIL'
              value: devLoginEmail
            }
            {
              name: 'DEV_LOGIN_PASSWORD'
              secretRef: 'dev-login-password'
            }
            {
              name: 'CORS_ALLOW_ORIGINS'
              value: 'https://${frontendApp.properties.configuration.ingress.fqdn}'
            }
            {
              name: 'UPLOAD_DIR'
              value: '/mnt/appdata/uploads'
            }
            {
              name: 'DATA_DIR'
              value: '/mnt/appdata/data'
            }
          ]
          volumeMounts: [
            {
              volumeName: 'appdata'
              mountPath: '/mnt/appdata'
            }
          ]
        }
      ]
      volumes: [
        {
          name: 'appdata'
          storageType: 'AzureFile'
          storageName: 'appdata'
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: environment == 'prod' ? 6 : 2
      }
    }
  }
  dependsOn: [
    managedEnvStorage
    postgresDb
    kvSecretApp
    kvSecretOpenAi
    kvSecretDevPassword
  ]
}

resource frontendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: frontendAppName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: managedEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 80
        transport: 'auto'
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'frontend'
          image: frontendImage
          resources: {
            cpu: frontendCpu
            memory: frontendMemory
          }
          env: [
            {
              name: 'VITE_API_BASE'
              value: viteApiBase
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: environment == 'prod' ? 4 : 2
      }
    }
  }
}

resource acrPullBackend 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.id, backendApp.id, 'AcrPull')
  scope: containerRegistry
  properties: {
    principalId: backendApp.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalType: 'ServicePrincipal'
  }
}

resource acrPullFrontend 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.id, frontendApp.id, 'AcrPull')
  scope: containerRegistry
  properties: {
    principalId: frontendApp.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalType: 'ServicePrincipal'
  }
}

resource backendKeyVaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, backendApp.id, 'KeyVaultSecretsUser')
  scope: keyVault
  properties: {
    principalId: backendApp.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalType: 'ServicePrincipal'
  }
}

module backendAzureOpenAiUser 'modules/azure-openai-rbac.bicep' = if (!empty(azureOpenAiResourceName)) {
  name: '${backendAppName}-aoai-rbac'
  scope: resourceGroup(azureOpenAiResourceGroup)
  params: {
    azureOpenAiResourceName: azureOpenAiResourceName
    principalId: backendApp.identity.principalId
  }
}

output frontendUrl string = 'https://${frontendApp.properties.configuration.ingress.fqdn}'
output backendUrl string = 'https://${backendApp.properties.configuration.ingress.fqdn}'
output containerRegistryLoginServer string = containerRegistry.properties.loginServer
output keyVaultUri string = keyVault.properties.vaultUri
