@description('Name of the Cognitive Services account')
param name string

@description('Azure region')
param location string

@description('Name of the AI Foundry project')
param projectName string

@description('Model deployment name')
param deploymentName string = 'gpt-realtime-mini'

@description('Model name to deploy')
param modelName string = 'gpt-realtime-mini'

@description('Model version')
param modelVersion string = '2025-12-15'

@description('Model deployment capacity (TPM in thousands)')
param deploymentCapacity int = 5

resource cognitiveServicesAccount 'Microsoft.CognitiveServices/accounts@2026-01-15-preview' = {
  name: name
  location: location
  kind: 'AIServices'
  identity: {
    type: 'SystemAssigned'
  }
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: name
    publicNetworkAccess: 'Enabled'
    allowProjectManagement: true
    disableLocalAuth: false
    restore: false
  }
}

resource aiProject 'Microsoft.CognitiveServices/accounts/projects@2026-01-15-preview' = {
  parent: cognitiveServicesAccount
  name: projectName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {}
}

resource modelDeployment 'Microsoft.CognitiveServices/accounts/deployments@2026-01-15-preview' = {
  parent: cognitiveServicesAccount
  name: deploymentName
  sku: {
    name: 'GlobalStandard'
    capacity: deploymentCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: modelName
      version: modelVersion
    }
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
    raiPolicyName: 'Microsoft.Default'
  }
}

@description('Endpoint of the Cognitive Services account (Voice Live API)')
output endpoint string = 'https://${cognitiveServicesAccount.name}.services.ai.azure.com/'

@description('Resource ID of the Cognitive Services account')
output id string = cognitiveServicesAccount.id

@description('Name of the Cognitive Services account')
output accountName string = cognitiveServicesAccount.name

@description('Resource ID of the AI Foundry project')
output projectId string = aiProject.id
