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
Users can instantly switch the assistant’s persona by selecting from a dropdown or prompt preset.

Supported industries:
- 🏥 **Healthcare** – patient triage, symptom queries, clinical guidance  
- 🛒 **Retail** – product recommendations, store support, order questions  
- 🎓 **Education** – tutoring, concept explanations, student engagement  
- 📺 **Media & Entertainment** – content recommendations, interactive experiences  
- ⚖️ **Legal** – case explanations, statute lookup, document guidance  
- 💳 **Finance** – account inquiry, credit education, fraud reporting  
- 🏭 **Manufacturing** – technician troubleshooting, equipment diagnostics  

Each industry uses a **direct system prompt** such as:

"You are an AI assistant specializing in healthcare triage. Provide safe, compliant responses and never give diagnosis. Ask follow-up questions where needed."


---

## 🛠️ Installation & Setup

### 1️⃣ Clone this repository
```bash
git clone https://github.com/ganachan/voice_live_api_gana.git
cd voice_live_api_gana

npm install

AZURE_OPENAI_ENDPOINT="<your endpoint>"
AZURE_OPENAI_API_KEY="<your key>"
AZURE_OPENAI_DEPLOYMENT_NAME="<your model name>"

npm run dev

http://localhost:3000

docker build -t voice-live-app .
docker run -p 3000:3000 voice-live-app

Extensibility

You can extend this project by adding:

Custom industry prompts

Avatar video integration

MCP Zero Tool Discovery

Real-time analytics dashboards

Memory-based agent workflows

Multi-agent orchestration through SK or Autogen
