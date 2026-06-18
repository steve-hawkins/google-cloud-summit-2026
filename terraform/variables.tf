variable "project_id" {
  type        = string
  description = "The Google Cloud Project ID to deploy resources to."
}

variable "region" {
  type        = string
  description = "The Google Cloud region to deploy resources."
  default     = "europe-west2"
}

variable "app_name" {
  type        = string
  description = "The name of the application."
  default     = "eco-pulse"
}

variable "image_url" {
  type        = string
  description = "The Docker image URL to deploy. Defaults to a standard hello-world placeholder if not specified."
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "billing_account_id" {
  type        = string
  description = "The Billing Account ID. If provided, enables creation of a monthly budget and Pub/Sub billing alert."
  default     = ""
}

variable "budget_amount" {
  type        = number
  description = "The target monthly budget amount in USD."
  default     = 10
}

variable "enable_ai_agent" {
  type        = bool
  description = "Enable the AI agent feature (chatbot UI and endpoint)."
  default     = false
}
