# EcoPulse — UK Carbon-Aware Workload Scheduler

EcoPulse is a green-computing dashboard and interactive AI assistant designed to help developers and users optimize workload schedules in the UK by running resource-intensive tasks during periods of lower grid carbon intensity. 

The application utilizes live grid intensity data and generation mixes from the **National Grid ESO API**, and leverages **Google Vertex AI** (`gemini-3.5-flash`) via the modern `@google/genai` SDK for conversational grid scheduling advice.

---

## Features

*   **Live Grid Intensity Indicators**: Dynamic, glassmorphic dashboard tracking current carbon intensity (gCO₂/kWh) with custom color-coded indicators, ambient glows, and fuel mix animations (gas, wind, nuclear, solar, etc.).
*   **Workload Scheduler**: Sliding-window optimization algorithm identifying the cleanest starting windows for task durations between 0.5 and 8 hours.
*   **AI Chat Assistant**: Floating chatbot widget enabling users to conversationalize grid queries (e.g. *"When should I run a 4-hour task?"* or *"What is the intensity in postcode EH1?"*).
*   **Caching & Resiliency**: Built-in 15-minute backend cache reducing external API network hops and ensuring sub-millisecond response times for repeat queries.
*   **WAF Verified Security**: Runs on a dedicated least-privilege service account, protected by API rate-limiting, with GCP metadata externalized to environment variables.
*   **Programmatic Cost Control**: Integrated monthly budget resources and Pub/Sub alerts paired with a billing-shutdown Cloud Function to prevent cost overruns.

---

## Repository Structure

```text
├── .agents/                 # Project-scoped AI agent customization rules and skills
├── .devcontainer/           # Dev container settings installing Terraform and gcloud CLI
├── .github/                 # GitHub workflows (CI tests, dependabot, PR templates)
├── frontend/                # Vite SPA dashboard (HTML/CSS/TypeScript)
├── src/                     # Backend Express API and Services (TypeScript)
│   ├── billing-shutdown/    # Cloud Function to automatically disable billing
│   ├── services/            # CarbonIntensityService, SchedulerService, AgentService
│   ├── app.ts               # Express application route configurations
│   └── server.ts            # Application server listener
├── terraform/               # Declarative IaC resources (Cloud Run, IAM, Pub/Sub, Budget)
└── tests/                   # Vitest unit and integration test suite (fully mocked)
```

---

## Local Development & Operations

### Prerequisites
Make sure dependencies are installed at both the root and frontend directories:
```bash
npm install
npm install --prefix frontend
```

### Running Locally
To launch the backend (port `8080`) and the frontend (port `5173`) in development modes:
1. **Start Backend**:
   ```bash
   npm run dev:backend
   ```
2. **Start Frontend** (in a separate terminal):
   ```bash
   npm run dev --prefix frontend
   ```

### Running Tests
To run the fully mocked Vitest test suite (including rate limit, scheduler, caching, and service unit tests):
```bash
npm test
```

### Production Build & Launch
To compile the Vite assets into the backend's static directory and build the TypeScript server:
```bash
npm run build
npm start
```

---

## Deployment & Architecture

*   **Deployment Guide**: Refer to [DEPLOY.md](file:///workspaces/google-cloud-summit-2026/DEPLOY.md) for manual deployment or automated Terraform orchestration using the bootstrap script `./deploy-iac.sh`.
*   **Well-Architected Framework (WAF) Review**: See [well_architected_review.md](file:///workspaces/google-cloud-summit-2026/well_architected_review.md) for detailed evaluation records, radar scores, and structural tradeoffs.