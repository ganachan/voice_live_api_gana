@description('Name of the Container Apps managed environment')
param name string

@description('Azure region')
param location string

resource managedEnvironment 'Microsoft.App/managedEnvironments@2025-07-01' = {
  name: name
  location: location
  properties: {
    zoneRedundant: false
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

@description('Resource ID of the managed environment')
output id string = managedEnvironment.id

@description('Name of the managed environment')
output environmentName string = managedEnvironment.name

@description('Default domain of the managed environment')
output defaultDomain string = managedEnvironment.properties.defaultDomain
