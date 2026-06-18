terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# 1. Enable Required APIs
locals {
  apis = [
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "aiplatform.googleapis.com"
  ]
}

resource "google_project_service" "apis" {
  for_each = toset(local.apis)
  project  = var.project_id
  service  = each.key

  disable_on_destroy = false
}

# 2. Create Artifact Registry Repository for Docker images
resource "google_artifact_registry_repository" "repo" {
  project       = var.project_id
  location      = var.region
  repository_id = var.app_name
  description   = "Docker repository for ${var.app_name} images"
  format        = "DOCKER"

  depends_on = [google_project_service.apis]
}

# 3. Create Cloud Run V2 Service
resource "google_cloud_run_v2_service" "app" {
  name     = var.app_name
  location = var.region
  project  = var.project_id
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = var.image_url

      resources {
        limits = {
          cpu    = "1"     # Represents 1 vCPU
          memory = "512Mi" # Free Tier maximum per instance
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      ports {
        container_port = 8080
      }
    }

    scaling {
      min_instance_count = 0 # Scale to 0 when idle to prevent costs
      max_instance_count = 3 # Cap instances to prevent scaling costs
    }
  }

  depends_on = [google_project_service.apis]
}

# 4. Allow unauthenticated public access to the Cloud Run service
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  project    = var.project_id
  location   = var.region
  name       = google_cloud_run_v2_service.app.name
  role       = "roles/run.invoker"
  member     = "allUsers"
  depends_on = [google_cloud_run_v2_service.app]
}
