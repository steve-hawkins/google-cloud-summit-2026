# Development Plan: Carbon-Aware Workload Scheduler

This plan outlines the design and step-by-step TDD (Test-Driven Development) implementation of our UK Carbon Intensity Tracker and Workload Scheduler. We will deploy the application as a single container on **Google Cloud Run** (which has a generous free tier of 2 million requests/month).

## Technology Stack
- **Backend**: Node.js, TypeScript, Express or Hono.
- **Frontend**: Vite + Vanilla HTML/CSS/JS (or React/TypeScript) with modern, premium styling (dark mode, glassmorphism, charts, micro-animations).
- **Testing**: Vitest (for modern, fast unit and integration testing).
- **External API**: [National Grid ESO Carbon Intensity API](https://api.carbonintensity.org.uk/) (free, no API key required).

---

## Suggested Developer Workflow
For each step:
1. **Write Tests First**: Create tests describing the expected behavior of the new feature.
2. **Verify Failure**: Run the tests to confirm they fail (red phase).
3. **Implement**: Write the minimal code to satisfy the tests.
4. **Verify Success**: Run the tests to confirm they pass (green phase).
5. **Request Approval**: Present the changes, code, and test results for your review before moving to the next step.

---

## Implementation Steps

### Step 1: Project Initialization & Test Setup
- **Goal**: Initialize the project structure, TypeScript configuration, and Vitest.
- **TDD Activity**: Write a simple math or helper test, verify it fails, then make it pass.
- **Outcome**: A solid project boilerplate with working testing infrastructure.

### Step 2: National Grid ESO API Integration
- **Goal**: Build a service layer to fetch carbon intensity data from the official UK API.
- **TDD Activity**: 
  - Mock API responses.
  - Write tests for retrieving current carbon intensity and the 24-48h forecast.
- **Outcome**: `CarbonIntensityService` that fetches current and forecast carbon intensity data.

### Step 3: Carbon-Aware Scheduler Logic
- **Goal**: Create an optimization algorithm to determine the lowest-carbon window for a workload of duration `D` (in hours) within a forecast window.
- **TDD Activity**:
  - Write tests with synthetic forecast data (e.g., finding the best 2-hour window in a 24-hour block).
  - Implement a sliding-window optimization algorithm that calculates the average carbon intensity and returns the start time of the lowest-intensity window.
- **Outcome**: `SchedulerService` that provides actionable insights on when to run jobs.

### Step 4: Express API Backend
- **Goal**: Build an Express API server with endpoints:
  - `/api/intensity/current` (returns current UK-wide or regional carbon intensity).
  - `/api/scheduler/optimize?durationHours=D` (returns optimal start time for a workload).
- **TDD Activity**: Use `supertest` to test endpoint responses, status codes, and error handling.
- **Outcome**: A working REST API server.

### Step 5: Frontend UI (Vite + Dashboard)
- **Goal**: Build a beautiful, responsive web interface.
  - A dashboard showing current carbon intensity (e.g., color-coded by low/medium/high).
  - A generation mix chart (coal, gas, wind, solar, etc.).
  - An interactive scheduler input where users specify a workload duration (e.g. "Run 3-hour job") and see the best time to start it.
- **TDD Activity**: Component unit tests or frontend helper function tests.
- **Outcome**: A premium UI with glassmorphic cards, CSS micro-animations, and clean typography.

### Step 6: Google Cloud Run Deployment Setup
- **Goal**: Add a `Dockerfile` and setup instructions for deploying to Google Cloud Run under the Free Tier.
- **Outcome**: Complete project ready for deploy-on-push or manual deployment to Cloud Run.
