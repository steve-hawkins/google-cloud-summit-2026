# EcoPulse - Ways of Working for AI Agents & Developers

This document defines the guidelines, conventions, and workflows that all AI agents and CLI tools must follow when working on the **EcoPulse** project.

## Development Workflow

### 1. Small, Iterative Changes
- Break tasks down into the smallest possible logical increments.
- Submit changes incrementally so the user can review, digest, and approve them step-by-step.
- Commit code small and often, using clear and descriptive commit messages.

### 2. Test-Driven Development (TDD)
Before implementing any feature or fixing any bug:
1. **Write Tests First**: Add unit or integration tests in the `tests/` directory describing the expected behavior.
2. **Verify Failure**: Run the tests to confirm they fail (red phase). Show the failure to the user for verification.
3. **Implement Minimum Code**: Write the simplest code to satisfy the tests.
4. **Verify Success**: Run the tests to confirm they pass (green phase). Show the successful results to the user.
5. **Propose and Approve**: Present the changes, code, and test results for user review before proceeding.

## Technology & Infrastructure Guidelines

### 1. Generative AI & LLM SDK
- For any Gemini integrations, use the modern `@google/genai` SDK.
- The standard model for this project is `gemini-3.5-flash` via Vertex AI.
- Configure Vertex AI with `vertexai: true`, using `project: "inlaid-fuze-499810-f7"` and `location: "us-central1"`.
- Access models using the Application Default Credentials (ADC) of the environment.

### 2. Code Structure
- **Backend**: Node.js/TypeScript Express API located in `src/`. Endpoints in `src/app.ts`, services in `src/services/`.
- **Frontend**: Vite SPA located in `frontend/`. Custom vanilla CSS in `frontend/src/style.css`.
- **Infrastructure**: Terraform configurations located in `terraform/`.
