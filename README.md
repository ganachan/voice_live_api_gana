# 🎤 Voice Live API – React Sample Application

This repository contains a **Next.js + React** sample application demonstrating how to use the **Azure AI Voice Live API** for real-time, low-latency speech interaction, audio streaming, transcription, and avatar-powered conversational experiences.

The application supports **direct industry-specific prompts**, enabling fast customization for enterprise verticals like Healthcare, Retail, Education, Media, Legal, Finance, and Manufacturing.

---

## 🚀 Features

### ✅ **Voice Live API Integration**
- Real-time microphone streaming  
- Low-latency audio + text responses  
- Multi-turn conversational memory  
- Direct server-to-client audio playback  

### 🏭 **Industry-Specific Prompting (Direct Prompt Mode)**
The application includes **out-of-the-box prompt templates** for multiple industries.  
Users can instantly switch the assistant's persona by selecting from a dropdown or prompt preset.

Supported industries:
- 🏥 **Healthcare** – patient triage, symptom queries, clinical guidance  
- 🛒 **Retail** – product recommendations, store support, order questions  
- 🎓 **Education** – tutoring, concept explanations, student engagement  
- 📺 **Media & Entertainment** – content recommendations, interactive experiences  
- ⚖️ **Legal** – case explanations, statute lookup, document guidance  
- 💳 **Finance** – account inquiry, credit education, fraud reporting  
- 🏭 **Manufacturing** – technician troubleshooting, equipment diagnostics  

Each industry uses a **direct system prompt** such as:

> "You are an AI assistant specializing in healthcare triage. Provide safe, compliant responses and never give diagnosis. Ask follow-up questions where needed."

---

## 🛠️ Local Development

### 1️⃣ Clone this repository
```bash
git clone https://github.com/ganachan/voice_live_api_gana.git
cd voice_live_api_gana
```

### 2️⃣ Install dependencies
```bash
npm install
pip install aiohttp azure-identity azure-ai-agents python-dotenv
```

### 3️⃣ Configure environment
Copy the example config and fill in your values:
```bash
cp .env.example .env
```

Edit `.env` with your AI Foundry settings:
```env
AZURE_OPENAI_ENDPOINT=https://<your-resource>.services.ai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-realtime-mini
RETURN_CONFIGS=true
```

**Authentication** uses `DefaultAzureCredential` (Entra ID) — no API keys are used.
For local development, sign in with:
```bash
az login
```

### 4️⃣ Run the app
```bash
# Frontend dev server (proxies /config to backend on :3001)
npm run dev

# Backend (serves config + tokens)
python3 app.py --port 3001
```
Open http://localhost:3000

### 🐳 Docker
```bash
docker build -t voice-live-app .
docker run -p 3000:3000 voice-live-app
```

---

## ☁️ Azure Deployment (azd)

The infrastructure is defined in Azure Bicep and deployed via the [Azure Developer CLI (azd)](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/).

### Prerequisites
- [Azure CLI](https://docs.microsoft.com/cli/azure/install-azure-cli) with Bicep
- [Azure Developer CLI (azd)](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/install-azd)
- [Docker](https://docs.docker.com/get-docker/) (for building the backend container)
- An Azure subscription with access to Azure AI Foundry

### Provisioned Resources
| Resource | Purpose |
|----------|---------|
| AI Foundry (AIServices + Project) | Cognitive Services account with `gpt-realtime-mini` model |
| Azure AI Search (Basic) | Knowledge base search for the `search` tool |
| Azure Container Registry (Basic) | Docker image hosting |
| Container Apps Environment + App | Python backend (serves `/config` + static files) |
| Static Web App (Free) | Next.js frontend |
| User-Assigned Managed Identity | Keyless auth with RBAC roles |
| Application Insights + Log Analytics | Monitoring and diagnostics |

### RBAC Roles (assigned automatically via Bicep)
| Role | Purpose |
|------|---------|
| Cognitive Services OpenAI User | OpenAI model access |
| Azure AI User | Voice Live Realtime API access |
| AcrPull | Container image pulls from ACR |
| Search Index Data Reader | AI Search queries |

### Deploy
```bash
# Initialize environment (first time only)
azd env new <env-name> --location eastus2

# Provision infrastructure + deploy app
azd up
```

If `azd up` has issues with Docker detection, you can deploy step by step:
```bash
# 1. Provision infrastructure
az deployment sub create --location eastus2 \
  --template-file infra/main.bicep \
  --parameters environmentName=<env-name> location=eastus2

# 2. Build and push the backend container
az acr login --name <acr-name>
docker build -t <acr-login-server>/voice-live-api:latest .
docker push <acr-login-server>/voice-live-api:latest

# 3. Update the container app
az containerapp update --name <ca-name> --resource-group rg-<env-name> \
  --image <acr-login-server>/voice-live-api:latest

# 4. Build and deploy the frontend
NEXT_PUBLIC_BACKEND_URL=<aca-url> npm run build
npx @azure/static-web-apps-cli deploy ./out \
  --deployment-token <swa-token> --env production
```

### Tear Down
```bash
az group delete --name rg-<env-name> --yes
```

### Infrastructure Layout
```
infra/
├── main.bicep                  # Subscription-scope orchestrator
├── main.parameters.json        # azd-wired parameters
├── bicepconfig.json            # Linting rules
├── modules/                    # Reusable Bicep modules
│   ├── cognitive-services.bicep
│   ├── managed-identity.bicep
│   ├── search-service.bicep
│   ├── container-registry.bicep
│   ├── container-apps-env.bicep
│   ├── role-assignments.bicep
│   ├── app-insights.bicep
│   └── diagnostic-settings.bicep
├── backend/
│   └── container-app.bicep
├── frontend/
│   └── static-web-app.bicep
└── env/
    └── dev.parameters.json
```
