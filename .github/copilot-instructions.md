# Copilot Instructions — Voice Live API Demo

## Build & Run

```bash
# Frontend (Next.js dev server on :3000, proxies /config to :3001)
npm run dev

# Backend (Python aiohttp on :3001, serves tokens + industry scenarios)
python3 app.py --port 3001

# Production build (static export to out/, served by app.py on :3000)
npm run build
python3 app.py

# Lint & format
npm run lint
npm run format
```

Requires `az login` for local Azure authentication (DefaultAzureCredential).

## Architecture

**Two-process app**: a Next.js frontend and a Python aiohttp backend.

- **Frontend** (`src/`): Next.js 15 + React 18 single-page app. On load, fetches `/config` from the backend to get an Entra ID token, Azure endpoint, deployment name, and industry scenario definitions. Uses the `rt-client` SDK (local `.tgz`) to open a real-time WebSocket session with Azure AI Voice Live API (`gpt-realtime` deployment).
- **Backend** (`app.py`): Minimal aiohttp server. Acquires Entra ID tokens via `DefaultAzureCredential`, defines industry scenario prompts (education, healthcare, manufacturing, finance, retail, etc.), and returns them through the `/config` endpoint. In production, also serves the static Next.js build from `out/`.
- **Dev proxy**: In development, `next.config.ts` rewrites `/config` to `http://localhost:3001/config`, so both servers run independently. In production, `output: 'export'` generates static files and app.py serves everything on port 3000.

### Real-time Audio Flow

1. `ChatInterface` creates an `RTClient` with the token from `/config`
2. `AudioHandler` (`src/lib/audio.ts`) captures mic at 24kHz via AudioWorklet with echo cancellation and noise suppression
3. Audio chunks are sent to `RTClient`, which streams back text + audio responses
4. `ProactiveEventManager` (`src/lib/proactive-event-manager.ts`) triggers greetings on session start and detects user inactivity (60s default)
5. Session recording tracks input/output on a timeline for stereo WAV export (user=left, assistant=right)

### Function Calling

The frontend registers tools with the RT session: `search` (Azure AI Search), `get_time`, `get_weather`, `calculate`, `microsoft_mcp_search`. Tool call results are sent back via `sendItem({ type: "function_call_output" })`.

## Conventions

- **UI components**: shadcn/ui (New York style) with Radix UI primitives. Add new components via `npx shadcn-ui@latest add <component>`. Components live in `src/components/ui/`, configured in `components.json`.
- **Styling**: Tailwind CSS with CSS variables for theming (defined in `globals.css`). Dark mode via class strategy. Custom purple gradient theme in `index.css`.
- **Path aliases**: `@/*` maps to `src/*` (e.g., `@/components/ui/button`, `@/lib/utils`).
- **State management**: All state lives in `ChatInterface` via `useState`/`useRef` hooks — no external state library.
- **Industry scenarios**: Defined in `app.py` as `industry_scenarios` dict. Each has `name`, `instructions` (with `{customerName}` placeholder), `pro_active` flag, and `voice` config (voice name + temperature). To add a new industry, add an entry to this dict.
- **Audio utilities**: `src/lib/audioConverters.ts` handles PCM/Float32 conversions and downsampling. `src/lib/audio.ts` manages recording, playback, waveform animation, and session recording.
- **Authentication**: Always Entra ID via `DefaultAzureCredential` — no API keys in code. Token scope: `https://cognitiveservices.azure.com/.default`.
- **Environment**: Configure via `.env` (see `.env.example`). Set `RETURN_CONFIGS=true` to enable the `/config` endpoint.
- **rt-client SDK**: Bundled as `rt-client-0.5.2.tgz` in the repo root. Built from a specific commit of `aoai-realtime-audio-sdk` (see Dockerfile for build steps).

## Infrastructure (Azure Bicep + azd)

The `infra/` directory contains Azure Bicep templates deployed via Azure Developer CLI (`azd`).

```bash
# Provision infrastructure and deploy the app
azd up

# Provision infrastructure only
azd provision

# Deploy app code only (after infra exists)
azd deploy

# Tear down all resources
azd down
```

### Bicep Structure
- `infra/main.bicep` — subscription-scope orchestrator (creates resource group + all resources)
- `infra/modules/` — reusable modules (managed identity, cognitive services, search, ACR, ACA env, RBAC)
- `infra/backend/` — Container App definition
- `infra/frontend/` — Static Web App definition
- `infra/env/` — environment-specific parameter overrides
- `infra/bicepconfig.json` — linting rules (security rules as errors)

### Resources Deployed
- AI Foundry (Cognitive Services, OpenAI kind) with `gpt-realtime-mini` model
- Azure AI Search (Basic tier)
- Azure Container Registry (Basic)
- Container Apps Environment (Consumption) + Container App (backend)
- Static Web App (Free tier, frontend)
- User-Assigned Managed Identity with RBAC: Cognitive Services OpenAI User, AcrPull, Search Index Data Reader

### Bicep Linting
Run `az bicep lint --file infra/main.bicep` to check for issues. The `bicepconfig.json` enforces security rules as errors and clean code rules as warnings.
