@description('Name of the user-assigned managed identity')
param name string

@description('Azure region for the managed identity')
param location string

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' = {
  name: name
  location: location
}

@description('Resource ID of the managed identity')
output id string = managedIdentity.id

@description('Principal ID of the managed identity')
output principalId string = managedIdentity.properties.principalId

@description('Client ID of the managed identity')
output clientId string = managedIdentity.properties.clientId
