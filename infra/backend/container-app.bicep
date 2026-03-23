@description('Name of the container app')
param name string

@description('Azure region')
param location string

@description('Resource ID of the Container Apps managed environment')
param managedEnvironmentId string

@description('ACR login server (e.g., myacr.azurecr.io)')
param acrLoginServer string

@description('Resource ID of the user-assigned managed identity')
param managedIdentityId string

@description('Azure OpenAI endpoint URL')
param azureOpenAIEndpoint string

@description('Azure OpenAI deployment name')
param azureOpenAIDeploymentName string = 'gpt-realtime-mini'

@description('Container image name and tag')
param containerImage string = ''

@description('Allowed CORS origins (comma-separated, e.g. SWA URL)')
param allowedOrigins string = ''

@description('Application Insights connection string')
param appInsightsConnectionString string = ''

resource containerApp 'Microsoft.App/containerApps@2025-07-01' = {
  name: name
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: managedEnvironmentId
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: acrLoginServer
          identity: managedIdentityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'voice-live-api'
          image: !empty(containerImage) ? containerImage : 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'AZURE_OPENAI_ENDPOINT'
              value: azureOpenAIEndpoint
            }
            {
              name: 'AZURE_OPENAI_DEPLOYMENT_NAME'
              value: azureOpenAIDeploymentName
            }
            {
              name: 'RETURN_CONFIGS'
              value: 'true'
            }
            {
              name: 'AZURE_CLIENT_ID'
              value: managedIdentityClientId
            }
            {
              name: 'ALLOWED_ORIGINS'
              value: allowedOrigins
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              value: appInsightsConnectionString
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
      }
    }
  }
}

// Extract client ID from identity for AZURE_CLIENT_ID env var
@description('Client ID of the managed identity (for DefaultAzureCredential)')
param managedIdentityClientId string

@description('FQDN of the container app')
output fqdn string = containerApp.properties.configuration.ingress.fqdn

@description('URL of the container app')
output url string = 'https://${containerApp.properties.configuration.ingress.fqdn}'

@description('Resource ID of the container app')
output id string = containerApp.id
