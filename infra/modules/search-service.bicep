@description('Name of the Azure AI Search service')
param name string

@description('Azure region')
param location string

resource searchService 'Microsoft.Search/searchServices@2025-05-01' = {
  name: name
  location: location
  sku: {
    name: 'basic'
  }
  properties: {
    hostingMode: 'Default'
    partitionCount: 1
    replicaCount: 1
    publicNetworkAccess: 'enabled'
    authOptions: {
      aadOrApiKey: {
        aadAuthFailureMode: 'http401WithBearerChallenge'
      }
    }
  }
}

@description('Endpoint URL of the search service')
output endpoint string = 'https://${searchService.name}.search.windows.net'

@description('Resource ID of the search service')
output id string = searchService.id

@description('Name of the search service')
output serviceName string = searchService.name
