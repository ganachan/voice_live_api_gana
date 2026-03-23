@description('Name of the static web app')
param name string

@description('Azure region')
param location string

@description('Application Insights connection string')
param appInsightsConnectionString string = ''

resource staticWebApp 'Microsoft.Web/staticSites@2024-04-01' = {
  name: name
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    buildProperties: {
      skipGithubActionWorkflowGeneration: true
    }
  }
}

resource appSettings 'Microsoft.Web/staticSites/config@2024-04-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    APPLICATIONINSIGHTS_CONNECTION_STRING: appInsightsConnectionString
  }
}

@description('Default hostname of the static web app')
output defaultHostname string = staticWebApp.properties.defaultHostname

@description('URL of the static web app')
output url string = 'https://${staticWebApp.properties.defaultHostname}'

@description('Resource ID of the static web app')
output id string = staticWebApp.id

@description('Name of the static web app')
output siteName string = staticWebApp.name
