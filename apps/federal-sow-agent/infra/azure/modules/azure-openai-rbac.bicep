targetScope = 'resourceGroup'

@description('Existing Azure OpenAI resource name.')
param azureOpenAiResourceName string

@description('Principal ID that should receive Azure OpenAI user access.')
param principalId string

resource azureOpenAiAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' existing = {
  name: azureOpenAiResourceName
}

resource cognitiveServicesOpenAiUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(azureOpenAiAccount.id, principalId, 'CognitiveServicesOpenAIUser')
  scope: azureOpenAiAccount
  properties: {
    principalId: principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd')
    principalType: 'ServicePrincipal'
  }
}
