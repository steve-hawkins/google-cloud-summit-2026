#!/bin/bash
# EcoPulse IaC Bootstrap and Deployment Script
# This script handles the multi-step deployment flow:
# 1. Bootstraps GCP APIs and Artifact Registry using Terraform.
# 2. Builds and pushes the Docker image to the new registry using Cloud Build.
# 3. Provisions the Cloud Run service pointing to the newly built image using Terraform.

# Exit immediately if a command exits with a non-zero status
set -e

# Text formatting colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}    EcoPulse IaC Deployment Bootstrap     ${NC}"
echo -e "${BLUE}==========================================${NC}"

# 1. Pre-flight Checks
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}Error: terraform is not installed.${NC}"
    echo -e "Please rebuild your Dev Container or install Terraform locally.${NC}"
    exit 1
fi

if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud (Google Cloud SDK) is not installed.${NC}"
    echo -e "Please rebuild your Dev Container or install the Google Cloud SDK locally.${NC}"
    exit 1
fi

# Ensure we run from the repository root
cd "$(dirname "$0")"

# 2. Determine GCP Project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    echo -e "${BLUE}No active Google Cloud project set. Let's configure it.${NC}"
    read -p "Enter your GCP Project ID: " USER_PROJECT_ID
    if [ -z "$USER_PROJECT_ID" ]; then
        echo -e "${RED}Error: GCP Project ID is required to deploy.${NC}"
        exit 1
    fi
    gcloud config set project "$USER_PROJECT_ID"
    PROJECT_ID="$USER_PROJECT_ID"
fi

echo -e "${GREEN}Using GCP Project ID: $PROJECT_ID${NC}"

# 3. Create terraform.tfvars if missing
TFVARS_FILE="terraform/terraform.tfvars"
if [ ! -f "$TFVARS_FILE" ]; then
    echo -e "${BLUE}Generating $TFVARS_FILE...${NC}"
    cat <<EOF > "$TFVARS_FILE"
project_id = "$PROJECT_ID"
region     = "europe-west2"
app_name   = "eco-pulse"
EOF
fi

# 4. Initialize Terraform
echo -e "${BLUE}Initializing Terraform...${NC}"
cd terraform
terraform init

# 5. Bootstrap API enabling & Artifact Registry creation
echo -e "${BLUE}Enabling Google Cloud APIs and creating Artifact Registry...${NC}"
terraform apply \
  -target=google_project_service.apis \
  -target=google_artifact_registry_repository.repo \
  -auto-approve

# Extract the Registry URL output from Terraform
REGISTRY_URL=$(terraform output -raw registry_url)
IMAGE_URL="${REGISTRY_URL}/eco-pulse:latest"

echo -e "${GREEN}Artifact Registry repository created successfully!${NC}"
echo -e "${GREEN}Target Image URL: $IMAGE_URL${NC}"

# 6. Build and push the Docker image
echo -e "${BLUE}Submitting build to Google Cloud Build...${NC}"
cd ..
gcloud builds submit --tag "$IMAGE_URL"

# 7. Complete Terraform Apply (provision Cloud Run and IAM policies)
echo -e "${BLUE}Deploying Google Cloud Run service with Terraform...${NC}"
cd terraform
terraform apply \
  -var="image_url=$IMAGE_URL" \
  -auto-approve

# Retrieve the live service URL
SERVICE_URL=$(terraform output -raw service_url)

echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}      DEPLOYMENT COMPLETED SUCCESSFULLY!   ${NC}"
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}Live Application URL:${NC}"
echo -e "${BLUE}$SERVICE_URL${NC}"
echo -e "${GREEN}==========================================${NC}"
