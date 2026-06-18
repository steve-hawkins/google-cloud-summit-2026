# Google Cloud Well-Architected Framework Review: EcoPulse

This report presents a comprehensive Well-Architected Framework Review for **EcoPulse** (UK Carbon Intensity Tracker and Workload Scheduler). It evaluates the project against the six core pillars of the Google Cloud Well-Architected Framework, highlights key tradeoffs, and provides a structured remediation roadmap.

---

## Executive Summary

EcoPulse is a green-computing dashboard and assistant deployed on **Google Cloud Run** that fetches carbon intensity data from the **National Grid ESO API** and leverages **Google Vertex AI** (`gemini-3.5-flash`) via the `@google/genai` SDK to help users schedule workloads during cleaner grid periods.

### Pillar Ratings

| Pillar | Rating | Primary Status |
| :--- | :---: | :--- |
| **1. Operational Excellence** | 🟡 Medium | Good IaC usage; tests run on real network APIs, causing CI/CD timeouts. |
| **2. Security, Privacy & Compliance** | 🔴 High Risk | Runs on Default Compute Service Account; lacks API rate limits. |
| **3. Reliability** | 🟡 Medium | Heavy synchronous external API dependency; lacks caching and resilient retry strategies. |
| **4. Cost Optimization** | 🟢 Excellent | Highly optimized for Cloud Run Free Tier with scale-to-zero configurations. |
| **5. Performance Optimization** | 🟡 Medium | Static assets served from container; API calls incur real-time external network hops. |
| **6. Sustainability** | 🟢 Excellent | Carbon-aware scheduling logic; minimal energy footprint when idle. |

```mermaid
radar-chart
    title Well-Architected Scores (Out of 10)
    Operational Excellence: 6
    Security, Privacy & Compliance: 4
    Reliability: 6
    Cost Optimization: 10
    Performance Optimization: 5
    Sustainability: 9
```

---

## 1. Operational Excellence

Operational Excellence focuses on running, monitoring, and continuously improving systems to deliver business value.

### Findings
*   **Infrastructure as Code (IaC)**: The project uses Terraform ([main.tf](file:///workspaces/google-cloud-summit-2026/terraform/main.tf)) for infrastructure provisioning, which is a strong pattern for environment parity.
*   **Deployment Automation**: A bootstrap shell script ([deploy-iac.sh](file:///workspaces/google-cloud-summit-2026/deploy-iac.sh)) is used to orchestrate API activation, building images via Cloud Build, and provisioning resources.
*   **Continuous Integration (CI)**: A GitHub Actions workflow ([ci.yml](file:///workspaces/google-cloud-summit-2026/.github/workflows/ci.yml)) automates building and testing on code pushes/PRs.
*   **Test-Driven Development (TDD) Issues**: The test suite in [agent.test.ts](file:///workspaces/google-cloud-summit-2026/tests/agent.test.ts) relies on real network calls to the external National Grid API and the Google Vertex AI API. This leads to:
    1.  Frequent test timeouts in CI (such as the 5000ms Vitest timeout failure in fallback test mode).
    2.  Flaky tests when external APIs are slow or unavailable.
    3.  Dependency on local Application Default Credentials (ADC) to pass tests.
*   **Logging**: The backend uses un-structured `console.log` and `console.warn` statements. This makes searching, filtering, and querying logs in Cloud Logging difficult and limits advanced log-based alerting.
*   **Health Checks**: There are no health check endpoints (e.g. `/healthz` or `/live`) configured in the Express app ([app.ts](file:///workspaces/google-cloud-summit-2026/src/app.ts)) for Cloud Run startup or liveness probes.

### Recommendations
1.  **Mock External Services in Tests**: Use Vitest mocks to stub `fetch` calls to the National Grid API and the Google GenAI SDK.
2.  **Structured JSON Logging**: Implement a library like `pino` or `winston` to output logs in JSON format matching Cloud Logging's schema.
3.  **Liveness & Readiness Probes**: Add a `/healthz` endpoint verifying connection health and configure it in the Terraform Cloud Run service.

---

## 2. Security, Privacy, and Compliance

This pillar covers protecting data, systems, and assets, and managing identities and permissions.

### Findings
*   **Privileged Service Account (Violation of Least Privilege)**: The Cloud Run service in [main.tf](file:///workspaces/google-cloud-summit-2026/terraform/main.tf) is provisioned without specifying a dedicated service account. By default, it runs using the **Default Compute Service Account**, which has wide `Editor` permissions on the project.
*   **Hardcoded Project Metadata**: The Vertex AI client in [agent.ts](file:///workspaces/google-cloud-summit-2026/src/services/agent.ts#L10-L16) hardcodes the GCP project ID (`inlaid-fuze-499810-f7`) and region (`us-central1`), limiting portability and leaking configuration details.
*   **Lack of Public API Rate-Limiting**: The backend exposes endpoints like `/api/chat` (which calls Vertex AI models) and `/api/scheduler/optimize` publicly. There is no rate-limiting, exposing the service to API abuse, quota exhaustion, and runaway billing.
*   **Public Access Configuration**: The service enables public access via `roles/run.invoker` bound to `allUsers`. While necessary for public access, the backend routes are completely unprotected.

### Recommendations
1.  **Least-Privilege Service Account**: Create a custom IAM Service Account in Terraform (e.g., `eco-pulse-runner`) and assign only `roles/aiplatform.user` to it.
2.  **Externalize Configurations**: Feed the Project ID, Region, and model parameters to the container via Environment Variables (`process.env.GCP_PROJECT_ID`) configured in Terraform.
3.  **API Rate Limiting**: Introduce `express-rate-limit` middleware on public API routes, especially `/api/chat`.

---

## 3. Reliability

Reliability focuses on preventing and recovering from service disruptions and scaling workloads gracefully.

### Findings
*   **Direct External Integration Dependencies**: The scheduler and chatbot rely synchronously on external APIs. If the National Grid API or Vertex AI is down, client-facing services fail.
*   **API Fallback Mechanism**: The system features a robust fallback mechanism: if the Vertex AI model call fails, [agent.ts](file:///workspaces/google-cloud-summit-2026/src/services/agent.ts#L95-L101) switches to a local rule-based response generator. This is a model pattern of graceful degradation.
*   **Lack of Caching**: Real-time intensity data is fetched on every user load. Since the National Grid API updates only every 30 minutes, this generates unnecessary latency and risk of rate limits.
*   **Cold Start Latency**: Cloud Run is configured with `min_instance_count = 0`. This is highly cost-effective but causes latency spikes (cold starts) when requests arrive after periods of inactivity.

### Recommendations
1.  **Data Caching**: Cache National Grid API responses (e.g. using `memory-cache` or Cloud Memorystore) for 15-30 minutes.
2.  **Resilient Request Retries**: Use retry policies with exponential backoff for outbound API requests.
3.  **Cold Start Mitigation**: If budget permits, set `min_instance_count = 1` to guarantee instant response times.

---

## 4. Cost Optimization

Cost Optimization ensures workloads run at the lowest possible cost, maximizing efficiency.

### Findings
*   **Zero Resource Waste**: The Cloud Run service runs with `min_instance_count = 0` (scale-to-zero when idle) and low limits (`512Mi` RAM, `1` CPU). It operates entirely within the **GCP Free Tier** limits (2 million requests/month).
*   **Stateless Architecture**: By bypassing a persistent database, the application avoids storage and instance costs.
*   **Cost-Efficient Model Choice**: Utilizing `gemini-3.5-flash` provides highly accurate responses at a fraction of the cost of larger frontier models.

### Recommendations
*   Keep the stateless scale-to-zero architecture to maintain zero active hosting costs.
*   Configure log retention policies in Cloud Logging to limit storage charges.

---

## 5. Performance Optimization

Performance Optimization focuses on using computing resources efficiently and maintaining that efficiency as demand changes.

### Findings
*   **Direct Static Asset Hosting**: The Node.js application serves the static Vite frontend assets directly ([app.ts](file:///workspaces/google-cloud-summit-2026/src/app.ts#L20)). This consumes CPU cycles and memory on Cloud Run that could be dedicated to API requests.
*   **Synchronous Processing**: Node.js is single-threaded. Running calculation loops synchronously on large arrays (like sliding-window forecasts) can block the event loop under heavy load.
*   **Outbound Network Latency**: Each API request initiates multiple real-time external network hops, adding ~300-800ms to request times.

### Recommendations
1.  **CDN / Static File Offloading**: Move frontend files to a Google Cloud Storage bucket and distribute them via Cloud CDN or Firebase Hosting.
2.  **Implement Request Caching**: Avoid external API calls entirely for repeat requests by serving cached values in <10ms.

---

## 6. Sustainability

Sustainability focuses on minimizing the environmental footprint of workloads.

### Findings
*   **Carbon-Aware Core**: The application's main purpose is to reduce emissions, making it an exemplary implementation of sustainable software design.
*   **Compute Footprint minimization**: Scaling container instances to zero when idle prevents idle CPU cycles, minimizing the carbon footprint.
*   **Hosting Region**: The application runs in `europe-west2` (London) or `us-central1` (Iowa). London's grid is cleaner than Iowa's, but both have a higher carbon intensity than regions like `europe-west6` (Zurich, Switzerland) or `europe-north1` (Hamina, Finland) which utilize >90% carbon-free energy.

### Recommendations
1.  **Low-Carbon Region Selection**: If latency permits, deploy Cloud Run services in high Carbon-Free Energy (CFE) regions such as Finland (`europe-north1`).

---

## Key Tradeoffs

Below is a comparison of architectural choices made in the project:

### 1. Scale-to-Zero (`min_instance_count = 0`) vs. Keep Warm (`min_instance_count = 1`)
*   **Option A (Current)**: Scale-to-Zero.
    *   *Pros*: Zero costs when idle; zero standby carbon emissions.
    *   *Cons*: First requests incur cold start delays (1-3 seconds).
*   **Option B**: Keep Warm.
    *   *Pros*: Instant response time; no cold starts.
    *   *Cons*: Constant monthly cost; continuous carbon footprint.

### 2. Live API Fetches vs. Caching Layer
*   **Option A (Current)**: Live API Fetches.
    *   *Pros*: Guarantee of real-time data freshness; simple, database-less architecture.
    *   *Cons*: High latency (~500ms+); risk of rate limits or external API downtime.
*   **Option B**: Caching (In-memory or Redis).
    *   *Pros*: Low latency (<10ms); resilient to external API failures.
    *   *Cons*: Slightly stale data (up to 30 mins); added memory usage.

---

## Actionable Recommendations Roadmap

### Phase 1: High Priority (Immediate Fixes)
1.  **Mock Test Suite APIs**: Mock external National Grid and Vertex AI requests in [agent.test.ts](file:///workspaces/google-cloud-summit-2026/tests/agent.test.ts) to fix the CI test timeout failure.
2.  **Apply Least-Privilege IAM**: Create a dedicated Service Account in [main.tf](file:///workspaces/google-cloud-summit-2026/terraform/main.tf) with access limited to Vertex AI (`roles/aiplatform.user`).
3.  **Externalize Env Variables**: Inject GCP project and region settings through container environment variables.

### Phase 2: Medium Priority (Reliability & Performance)
1.  **Implement In-Memory Cache**: Cache the carbon forecast in the backend for 30 minutes to reduce external load and latency.
2.  **Add Rate Limiter**: Put rate-limiting middleware in front of the `/api/chat` endpoint to protect resources.
3.  **Add Health Checks**: Configure readiness and liveness endpoints for the Cloud Run container.

### Phase 3: Long-Term (Enterprise Scaling)
1.  **Deploy Static Assets to CDN**: Host Vite static files on GCS/CDN to offload the Express container.
2.  **Move to Clean-Energy Region**: Re-deploy backend services to a low-carbon region like `europe-north1` (Hamina, Finland).
3.  **Structured JSON Logging**: Integrate JSON-structured logging for advanced observability in Google Cloud Logging.
