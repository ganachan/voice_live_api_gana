@description('Principal ID of the managed identity to assign roles to')
param principalId string

@description('Resource ID of the Cognitive Services account')
param cognitiveServicesAccountId string

@description('Resource ID of the Container Registry')
param containerRegistryId string

@description('Resource ID of the Azure AI Search service')
param searchServiceId string

// Cognitive Services OpenAI User
var cognitiveServicesOpenAIUserRoleId = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'

// Azure AI User (required for Voice Live Realtime API)
var azureAIUserRoleId = '53ca6127-db72-4b80-b1b0-d745d6d5456d'

// AcrPull
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

// Search Index Data Reader
var searchIndexDataReaderRoleId = '1407120a-92aa-4202-b7e9-c0e197c71c8f'

resource cognitiveServicesRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(cognitiveServicesAccountId, principalId, cognitiveServicesOpenAIUserRoleId)
  scope: cognitiveServicesAccount
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesOpenAIUserRoleId)
  }
}

resource azureAIUserRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(cognitiveServicesAccountId, principalId, azureAIUserRoleId)
  scope: cognitiveServicesAccount
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', azureAIUserRoleId)
  }
}

resource acrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistryId, principalId, acrPullRoleId)
  scope: containerRegistry
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
  }
}

resource searchRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(searchServiceId, principalId, searchIndexDataReaderRoleId)
  scope: searchService
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', searchIndexDataReaderRoleId)
  }
}

// Existing resource references for scoping
resource cognitiveServicesAccount 'Microsoft.CognitiveServices/accounts@2026-01-15-preview' existing = {
  name: last(split(cognitiveServicesAccountId, '/'))
}

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2025-11-01' existing = {
  name: last(split(containerRegistryId, '/'))
}

resource searchService 'Microsoft.Search/searchServices@2025-05-01' existing = {
  name: last(split(searchServiceId, '/'))
}
