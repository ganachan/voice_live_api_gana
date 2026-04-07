@description('Name of the Azure Container Registry')
param name string

@description('Azure region')
param location string

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2025-11-01' = {
  name: name
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

@description('Login server URL of the container registry')
output loginServer string = containerRegistry.properties.loginServer

@description('Resource ID of the container registry')
output id string = containerRegistry.id

@description('Name of the container registry')
output registryName string = containerRegistry.name
