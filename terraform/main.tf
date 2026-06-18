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
    "aiplatform.googleapis.com",
    "iam.googleapis.com",
    "pubsub.googleapis.com",
    "billingbudgets.googleapis.com"
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

# 3. Dedicated Least-Privilege IAM Service Account for the Cloud Run app
resource "google_service_account" "app_sa" {
  project      = var.project_id
  account_id   = "${var.app_name}-runner"
  display_name = "Service Account for running ${var.app_name} on Cloud Run"
  depends_on   = [google_project_service.apis]
}

# Grant Vertex AI access (Vertex AI User role) to the service account
resource "google_project_iam_member" "vertex_ai_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.app_sa.email}"
}

# 4. Create Cloud Run V2 Service
resource "google_cloud_run_v2_service" "app" {
  name     = var.app_name
  location = var.region
  project  = var.project_id
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.app_sa.email

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

      env {
        name  = "GCP_PROJECT"
        value = var.project_id
      }

      env {
        name  = "GCP_REGION"
        value = var.region
      }

      ports {
        container_port = 8080
      }

      startup_probe {
        initial_delay_seconds = 5
        timeout_seconds       = 3
        period_seconds        = 10
        failure_threshold     = 6
        http_get {
          path = "/healthz"
        }
      }

      liveness_probe {
        timeout_seconds   = 3
        period_seconds    = 30
        failure_threshold = 3
        http_get {
          path = "/healthz"
        }
      }
    }

    scaling {
      min_instance_count = 0 # Scale to 0 when idle to prevent costs
      max_instance_count = 3 # Cap instances to prevent scaling costs
    }
  }

  depends_on = [google_project_service.apis, google_service_account.app_sa]
}

# 5. Allow unauthenticated public access to the Cloud Run service
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  project    = var.project_id
  location   = var.region
  name       = google_cloud_run_v2_service.app.name
  role       = "roles/run.invoker"
  member     = "allUsers"
  depends_on = [google_cloud_run_v2_service.app]
}

# 6. Pub/Sub Topic for Billing Alerts
resource "google_pubsub_topic" "billing_alerts" {
  name    = "${var.app_name}-billing-alerts"
  project = var.project_id

  depends_on = [google_project_service.apis]
}

# 7. Monthly Billing Budget (Created only if billing_account_id is provided)
resource "google_billing_budget" "budget" {
  count           = var.billing_account_id != "" ? 1 : 0
  billing_account = var.billing_account_id
  display_name    = "${var.app_name}-monthly-budget"

  budget_filter {
    projects = ["projects/${var.project_id}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.budget_amount)
    }
  }

  threshold_rules {
    threshold_percent = 0.5
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 0.9
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "CURRENT_SPEND"
  }

  all_updates_rule {
    pubsub_topic   = google_pubsub_topic.billing_alerts.id
    schema_version = "1.0"
  }
}
