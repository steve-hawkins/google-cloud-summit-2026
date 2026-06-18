# Implementation Summary: EcoPulse AI Query Agent

We have implemented an **AI Querying Agent** for the EcoPulse Carbon-Aware Scheduler, established project-wide **Ways of Working** rules for AI agents, and verified everything using **Test-Driven Development (TDD)**.

---

## 1. Ways of Working established (`AGENTS.md`)
We created [AGENTS.md](file:///workspaces/google-cloud-summit-2026/terraform/.agents/AGENTS.md) (and replicated at the project root) to guide all future AI operations:
- **Small, Iterative Changes**: Submit changes incrementally for step-by-step review and commit small and often.
- **TDD Workflow**: Write tests first, verify failure (Red), write minimum code, verify success (Green), and propose.
- **Gemini Config**: Use the `@google/genai` SDK with `gemini-3.5-flash` in `us-central1` via Vertex AI.

---

## 2. TDD Phases (Tests Created & Passed)
We created a new test suite [agent.test.ts](file:///workspaces/google-cloud-summit-2026/tests/agent.test.ts):
- **Red Phase**: Running `npm test` failed initially because the backend service and route did not exist.
- **Green Phase**: Implementing `AgentService` and the endpoint resulted in all **18/18 tests passing successfully**:
  ```bash
   Test Files  5 passed (5)
        Tests  18 passed (18)
     Duration  8.23s
  ```

---

## 3. Implementation Details

### A. Backend Agent Service (`agent.ts`)
We created [agent.ts](file:///workspaces/google-cloud-summit-2026/src/services/agent.ts) which:
1. Gathers current national intensity, 48-hour forecasts, and optimal workload windows (for 1h, 2h, 4h, and 8h tasks).
2. Performs postcode lookups (e.g. `EH1`) if a postcode is detected in the message.
3. Formulates a context-rich prompt and calls `gemini-3.5-flash` via Vertex AI.
4. **Fallback Mechanism**: If the project lacks Vertex AI access or model access in that region, it falls back to a rule-based generator that uses live API data to construct accurate, natural answers.

### B. Chat API Endpoint (`app.ts`)
We added the `POST /api/chat` route in [app.ts](file:///workspaces/google-cloud-summit-2026/src/app.ts) to handle incoming messages:
```typescript
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  const reply = await agentService.query(message);
  return res.json({ response: reply });
});
```

### C. Floating Glassmorphic UI Widget
We integrated a floating chat drawer into the client frontend:
- **HTML Markup ([index.html](file:///workspaces/google-cloud-summit-2026/frontend/index.html))**: Added bubble trigger button, drawer window, suggestion chips (e.g., "Best time for 4h task?"), and messaging pane.
- **Styles ([style.css](file:///workspaces/google-cloud-summit-2026/frontend/style.css))**: Styled with premium glassmorphism (`backdrop-filter`), smooth expansion keyframe animations, scrollable messaging list, and user/agent bubble styles.
- **Logic ([main.ts](file:///workspaces/google-cloud-summit-2026/frontend/src/main.ts))**: Manages toggle visibility, scroll-to-bottom, loading/typing indicator animations, suggestion chip clicks, and API POST communications.

---

## 4. Infrastructure Updates (`main.tf`)
We modified [main.tf](file:///workspaces/google-cloud-summit-2026/terraform/main.tf) to include the **Vertex AI API** (`aiplatform.googleapis.com`) in the list of services deployed by Terraform.
