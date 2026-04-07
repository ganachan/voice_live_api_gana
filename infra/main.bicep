targetScope = 'subscription'

@description('Name of the environment (used as prefix for all resources)')
param environmentName string

@description('Azure region for all resources')
param location string = 'westus2'

@description('Model deployment name')
param modelDeploymentName string = 'gpt-realtime-mini'

@description('Model name to deploy')
param modelName string = 'gpt-realtime-mini'

@description('Model version')
param modelVersion string = '2025-12-15'

@description('Model deployment capacity (TPM in thousands)')
param modelDeploymentCapacity int = 5

var resourceToken = uniqueString(subscription().id, environmentName, location)
var resourceGroupName = 'rg-${environmentName}'
var managedIdentityName = 'id-${environmentName}-${resourceToken}'
var cognitiveServicesName = 'cog-${environmentName}-${resourceToken}'
var aiProjectName = 'proj-${environmentName}-${resourceToken}'
var searchServiceName = 'srch-${environmentName}-${resourceToken}'
var containerRegistryName = 'cr${environmentName}${resourceToken}'
var containerAppsEnvName = 'cae-${environmentName}-${resourceToken}'
var containerAppName = 'ca-${environmentName}-${resourceToken}'
var staticWebAppName = 'swa-${environmentName}-${resourceToken}'
var logAnalyticsName = 'log-${environmentName}-${resourceToken}'
var appInsightsName = 'appi-${environmentName}-${resourceToken}'

resource rg 'Microsoft.Resources/resourceGroups@2025-04-01' = {
  name: resourceGroupName
  location: location
}

module managedIdentity 'modules/managed-identity.bicep' = {
  name: 'managed-identity'
  scope: rg
  params: {
    name: managedIdentityName
    location: location
  }
}

module cognitiveServices 'modules/cognitive-services.bicep' = {
  name: 'cognitive-services'
  scope: rg
  params: {
    name: cognitiveServicesName
    location: location
    projectName: aiProjectName
    deploymentName: modelDeploymentName
    modelName: modelName
    modelVersion: modelVersion
    deploymentCapacity: modelDeploymentCapacity
  }
}

module searchService 'modules/search-service.bicep' = {
  name: 'search-service'
  scope: rg
  params: {
    name: searchServiceName
    location: location
  }
}

module containerRegistry 'modules/container-registry.bicep' = {
  name: 'container-registry'
  scope: rg
  params: {
    name: containerRegistryName
    location: location
  }
}

module containerAppsEnv 'modules/container-apps-env.bicep' = {
  name: 'container-apps-env'
  scope: rg
  params: {
    name: containerAppsEnvName
    location: location
  }
}

module roleAssignments 'modules/role-assignments.bicep' = {
  name: 'role-assignments'
  scope: rg
  params: {
    principalId: managedIdentity.outputs.principalId
    cognitiveServicesAccountId: cognitiveServices.outputs.id
    containerRegistryId: containerRegistry.outputs.id
    searchServiceId: searchService.outputs.id
  }
}

module staticWebApp 'frontend/static-web-app.bicep' = {
  name: 'static-web-app'
  scope: rg
  params: {
    name: staticWebAppName
    location: location
    appInsightsConnectionString: appInsights.outputs.connectionString
  }
}

module appInsights 'modules/app-insights.bicep' = {
  name: 'app-insights'
  scope: rg
  params: {
    workspaceName: logAnalyticsName
    appInsightsName: appInsightsName
    location: location
  }
}

module containerApp 'backend/container-app.bicep' = {
  name: 'container-app'
  scope: rg
  params: {
    name: containerAppName
    location: location
    managedEnvironmentId: containerAppsEnv.outputs.id
    acrLoginServer: containerRegistry.outputs.loginServer
    managedIdentityId: managedIdentity.outputs.id
    managedIdentityClientId: managedIdentity.outputs.clientId
    azureOpenAIEndpoint: cognitiveServices.outputs.endpoint
    azureOpenAIDeploymentName: modelDeploymentName
    allowedOrigins: staticWebApp.outputs.url
    appInsightsConnectionString: appInsights.outputs.connectionString
  }
  dependsOn: [
    roleAssignments
  ]
}

module diagnosticSettings 'modules/diagnostic-settings.bicep' = {
  name: 'diagnostic-settings'
  scope: rg
  params: {
    workspaceId: appInsights.outputs.workspaceId
    cognitiveServicesId: cognitiveServices.outputs.id
    containerRegistryId: containerRegistry.outputs.id
    containerAppsEnvId: containerAppsEnv.outputs.id
    searchServiceId: searchService.outputs.id
  }
}

// Outputs for azd and downstream use
output AZURE_RESOURCE_GROUP string = rg.name
output AZURE_CONTAINER_REGISTRY_LOGIN_SERVER string = containerRegistry.outputs.loginServer
output AZURE_CONTAINER_REGISTRY_NAME string = containerRegistry.outputs.registryName
output AZURE_OPENAI_ENDPOINT string = cognitiveServices.outputs.endpoint
output AZURE_OPENAI_DEPLOYMENT_NAME string = modelDeploymentName
output AZURE_SEARCH_ENDPOINT string = searchService.outputs.endpoint
output AZURE_CONTAINER_APP_URL string = containerApp.outputs.url
output AZURE_CONTAINER_APP_FQDN string = containerApp.outputs.fqdn
output AZURE_STATIC_WEB_APP_URL string = staticWebApp.outputs.url
output AZURE_STATIC_WEB_APP_NAME string = staticWebApp.outputs.siteName
output AZURE_MANAGED_IDENTITY_CLIENT_ID string = managedIdentity.outputs.clientId
output AZURE_APP_INSIGHTS_CONNECTION_STRING string = appInsights.outputs.connectionString
