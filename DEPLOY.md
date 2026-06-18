# Deployment Guide: Google Cloud Run (Free Tier)

This guide walks you through deploying **EcoPulse** to Google Cloud Run utilizing the Google Cloud Free Tier.

## Google Cloud Free Tier Benefits Used
1. **Google Cloud Build**: 120 free build-minutes per day. Used to build your Docker image in the cloud.
2. **Google Cloud Run**: 2 million free requests per month, 360,000 GB-seconds memory, and 180,000 vCPU-seconds per month.
3. **Artifact Registry**: 5 GB of storage free per month.

---

## Step 1: Install & Authenticate the Google Cloud SDK

1. Download and install the [Google Cloud SDK](https://cloud.google.com/sdk).
2. Authenticate the CLI with your Google Account:
   ```bash
   gcloud auth login
   ```
3. Set your active Google Cloud project ID (replace `YOUR_PROJECT_ID` with your actual project ID):
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   ```

---

## Step 2: Enable Required APIs

Enable the Cloud Build and Cloud Run APIs for your project:
```bash
gcloud services enable run.googleapis.com builds.googleapis.com artifactregistry.googleapis.com
```

---

## Step 3: Build the Docker Image (using Google Cloud Build)

Submit the source code to Google Cloud Build. This uploads the codebase, builds the multi-stage Docker image, and registers it in your project's Container/Artifact Registry.
```bash
gcloud builds submit --tag gcr.io/$(gcloud config get-value project)/eco-pulse
```

---

## Step 4: Deploy to Google Cloud Run

Deploy the container image to Cloud Run using configurations optimized to remain strictly within the **Free Tier limit**:
- `--min-instances 0`: Shuts down the container to zero instances when idle, incurring no standby costs.
- `--max-instances 3`: Caps instances to prevent scaling costs during traffic spikes.
- `--memory 512Mi`: Keeps memory usage low, fitting into the free tier allocation.
- `--region europe-west2`: Deploys the service to the London region (optimal for UK users).

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

Once deployment completes, the CLI will output a live URL (e.g., `https://eco-pulse-xxxxxx.a.run.app`) where your app is publicly accessible.
