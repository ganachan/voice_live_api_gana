@description('Log Analytics workspace ID to send diagnostics to')
param workspaceId string

@description('Resource ID of the Cognitive Services account')
param cognitiveServicesId string

@description('Resource ID of the Container Registry')
param containerRegistryId string

@description('Resource ID of the Container Apps Environment')
param containerAppsEnvId string

@description('Resource ID of the AI Search service')
param searchServiceId string

resource cogSvcDiag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-cogsvc'
  scope: cognitiveServicesAccount
  properties: {
    workspaceId: workspaceId
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

resource acrDiag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-acr'
  scope: containerRegistry
  properties: {
    workspaceId: workspaceId
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

resource caeDiag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-cae'
  scope: containerAppsEnv
  properties: {
    workspaceId: workspaceId
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

// Note: Container App logs are captured via the managed environment diagnostic settings above.
// Individual container app diagnostic settings are not supported on Consumption workload profiles.

resource searchDiag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-search'
  scope: searchService
  properties: {
    workspaceId: workspaceId
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

// Existing resource references for scoping
resource cognitiveServicesAccount 'Microsoft.CognitiveServices/accounts@2026-01-15-preview' existing = {
  name: last(split(cognitiveServicesId, '/'))
}

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2025-11-01' existing = {
  name: last(split(containerRegistryId, '/'))
}

resource containerAppsEnv 'Microsoft.App/managedEnvironments@2025-07-01' existing = {
  name: last(split(containerAppsEnvId, '/'))
}

resource searchService 'Microsoft.Search/searchServices@2025-05-01' existing = {
  name: last(split(searchServiceId, '/'))
}
