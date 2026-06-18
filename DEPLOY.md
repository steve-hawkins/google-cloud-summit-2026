# Deployment Guide: Google Cloud Run (Free Tier)

This guide walks you through deploying **EcoPulse** to Google Cloud Run utilizing the Google Cloud Free Tier.

We provide two deployment options:
1. **Option A: Infrastructure as Code (IaC) with Terraform (Recommended)**: Automate all infrastructure provisioning, updates, and settings.
2. **Option B: Manual CLI deployment**: A manual workflow using only the `gcloud` CLI.

---

## Google Cloud Free Tier Benefits Used
1. **Google Cloud Build**: 120 free build-minutes per day. Used to build your Docker image in the cloud.
2. **Google Cloud Run**: 2 million free requests per month, 360,000 GB-seconds memory, and 180,000 vCPU-seconds per month.
3. **Artifact Registry**: 5 GB of storage free per month.

---

## Option A: Infrastructure as Code with Terraform (Recommended)

Using Terraform allows you to define your deployment configurations declaratively, ensuring consistent environments, auditability, and simple teardown.

### Prerequisites

1. **Rebuild the Dev Container**: The workspace configuration in [devcontainer.json](file:///.devcontainer/devcontainer.json) has been updated to run a custom setup script that automatically installs the Google Cloud SDK CLI alongside Terraform when the container is built or rebuilt.
2. **Authenticate with GCP**:
   ```bash
   gcloud auth login
   ```

### Automated Deployment

We provide an orchestration script that automates the entire flow:
- Creating a `terraform.tfvars` configuration.
- Initializing Terraform.
- Enabling necessary GCP APIs (`run.googleapis.com`, `artifactregistry.googleapis.com`, `cloudbuild.googleapis.com`).
- Provisioning the Artifact Registry Docker repository.
- Building the Docker image via Google Cloud Build and pushing it to the new registry.
- Provisioning the Cloud Run service and configuring IAM policies for public access.

Run the following command from the project root:
```bash
./deploy-iac.sh
```

Once deployment completes, the script will output the live URL of your app (e.g., `https://eco-pulse-xxxxxx.a.run.app`).

### Manual Terraform Usage

If you prefer to run Terraform commands manually step-by-step:

1. **Create the variables file**: Create `terraform/terraform.tfvars` from the template:
   ```hcl
   project_id = "YOUR_PROJECT_ID"
   region     = "europe-west2"
   app_name   = "eco-pulse"
   ```

2. **Initialize and Bootstrap Registry**:
   We target the API enabling and Registry resources first so they exist before we submit the build:
   ```bash
   cd terraform
   terraform init
   terraform apply -target=google_project_service.apis -target=google_artifact_registry_repository.repo -auto-approve
   ```

3. **Build the Image**:
   Use Cloud Build to build and push to the new repository:
   ```bash
   cd ..
   gcloud builds submit --tag europe-west2-docker.pkg.dev/YOUR_PROJECT_ID/eco-pulse/eco-pulse:latest
   ```

4. **Deploy the Rest of the Infrastructure**:
   Now deploy the Cloud Run service pointing to the container:
   ```bash
   cd terraform
   terraform apply -var="image_url=europe-west2-docker.pkg.dev/YOUR_PROJECT_ID/eco-pulse/eco-pulse:latest" -auto-approve
   ```

### Teardown / Cleanup

To delete all provisioned resources (Artifact Registry, Cloud Run service, APIs) and ensure zero future costs:
```bash
cd terraform
terraform destroy -auto-approve
```

---

## Option B: Manual CLI deployment

For reference, this section describes the manual deployment path using only `gcloud` commands.

### Step 1: Authenticate the Google Cloud SDK

1. Authenticate the CLI with your Google Account:
   ```bash
   gcloud auth login
   ```
2. Set your active Google Cloud project ID (replace `YOUR_PROJECT_ID` with your actual project ID):
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   ```

### Step 2: Enable Required APIs

Enable the Cloud Build and Cloud Run APIs for your project:
```bash
gcloud services enable run.googleapis.com builds.googleapis.com artifactregistry.googleapis.com
```

### Step 3: Build the Docker Image (using Google Cloud Build)

Submit the source code to Google Cloud Build:
```bash
gcloud builds submit --tag gcr.io/$(gcloud config get-value project)/eco-pulse
```

### Step 4: Deploy to Google Cloud Run

Deploy the container image to Cloud Run using configurations optimized to remain strictly within the **Free Tier limit**:
- `--min-instances 0`: Shuts down the container to zero instances when idle, incurring no standby costs.
- `--max-instances 3`: Caps instances to prevent scaling costs during traffic spikes.
- `--memory 512Mi`: Keeps memory usage low, fitting into the free tier allocation.
- `--region europe-west2`: Deploys the service to the London region.

Run the following command to deploy:
```bash
gcloud run deploy eco-pulse \
  --image gcr.io/$(gcloud config get-value project)/eco-pulse \
  --platform managed \
  --region europe-west2 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 3 \
  --memory 512Mi \
  --cpu 1
```

---

## Programmatic Billing Shutdown (Budget Alerts & Pub/Sub)

To prevent runaway billing costs, we provision a `google_billing_budget` resource that publishes notifications to the `eco-pulse-billing-alerts` Pub/Sub topic when spending exceeds 50%, 90%, or 100% of your limit. 

You can deploy a Cloud Function that listens to this topic and programmatically disables billing to shut down all services.

### Step 1: Grant Billing Account Administrator Permissions
The Cloud Function requires permissions to modify billing configurations.
1. Identify the service account of your Cloud Function or create one (e.g. `billing-shutdown-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com`).
2. In the GCP Console, go to **Billing > Account Management**.
3. Under permissions, add the service account as a member and grant it the **Billing Account Administrator** role.

### Step 2: Deploy the Cloud Function
Deploy a Node.js Cloud Function triggered by the Pub/Sub topic:

```bash
gcloud functions deploy billing-shutdown \
  --runtime nodejs20 \
  --trigger-topic eco-pulse-billing-alerts \
  --entry-point stopBilling \
  --service-account billing-shutdown-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --region europe-west2
```

### Cloud Function Implementation (`index.js`)

Below is the code for the Cloud Function. It parses the Pub/Sub budget event and disables billing for the project if spend exceeds 100% of the budget:

```javascript
const { google } = require('googleapis');
const billing = google.cloudbilling('v1');

exports.stopBilling = async (pubsubEvent, context) => {
  const data = JSON.parse(Buffer.from(pubsubEvent.data, 'base64').toString());
  const costAmount = data.costAmount;
  const budgetAmount = data.budgetAmount;
  const projectId = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

  console.log(`Current Spend: $${costAmount} (Budget limit: $${budgetAmount}) for project ${projectId}`);

  if (costAmount >= budgetAmount) {
    console.log('Budget limit exceeded! Disabling billing...');
    
    // Authenticate client
    const auth = await google.auth.getClient({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    google.options({ auth });

    const name = `projects/${projectId}/billingInfo`;
    try {
      await billing.projects.updateBillingInfo({
        name: name,
        resource: { billingAccountName: '' } // Disables billing for this project
      });
      console.log(`Successfully disabled billing for project ${projectId}`);
    } catch (err) {
      console.error(`Failed to disable billing:`, err);
    }
  } else {
    console.log(`Spend is under budget limits. No action taken.`);
  }
};
```

