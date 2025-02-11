# main.tf

terraform {
  required_version = ">= 0.14"

  required_providers {
    # Cloud Run support was added on 3.3.0
    google = ">= 3.3"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# #############################################
# #               Enable API's                #
# #############################################
# Enable IAM API
resource "google_project_service" "iam" {
  service            = "iam.googleapis.com"
  disable_on_destroy = false
}

# Enable Artifact Registry API
resource "google_project_service" "artifactregistry" {
  service            = "artifactregistry.googleapis.com"
  disable_on_destroy = false
}

# Enable Cloud Run API
resource "google_project_service" "cloudrun" {
  service            = "run.googleapis.com"
  disable_on_destroy = false
}

# Enable Cloud Resource Manager API
resource "google_project_service" "resourcemanager" {
  service            = "cloudresourcemanager.googleapis.com"
  disable_on_destroy = false
}

# #############################################
# #    Google Artifact Registry Repository    #
# #############################################
# # Create Artifact Registry Repository for Docker containers
# resource "google_artifact_registry_repository" "my_docker_repo" {
#   location = var.region
#   repository_id = var.repository
#   description = "My docker repository"
#   format = "DOCKER"
#   depends_on = [time_sleep.wait_30_seconds]
# }
# # Create a service account
# resource "google_service_account" "docker_pusher" {
#   account_id   = "docker-pusher"
#   display_name = "Docker Container Pusher"
#   depends_on =[time_sleep.wait_30_seconds]
# }
# # Give service account permission to push to the Artifact Registry Repository
# resource "google_artifact_registry_repository_iam_member" "docker_pusher_iam" {
#   location = google_artifact_registry_repository.my_docker_repo.location
#   repository =  google_artifact_registry_repository.my_docker_repo.repository_id
#   role   = "roles/artifactregistry.writer"
#   member = "serviceAccount:${google_service_account.docker_pusher.email}"
#   depends_on = [
#     google_artifact_registry_repository.my_docker_repo,
#     google_service_account.docker_pusher
#     ]
# }


# Create the Cloud Run service
resource "google_cloud_run_service" "run_service" {
  name = var.app_name
  location = var.region

  template {
    spec {
      containers {
        image = var.docker_image
        ports {
          container_port = 6789
        }
        resources {
          limits = {
            cpu     = var.container_cpu
            memory  = var.container_memory
          }
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  # Waits for the Cloud Run API to be enabled
  depends_on = [google_project_service.cloudrun]
}

# Allow unauthenticated users to invoke the service
resource "google_cloud_run_service_iam_member" "run_all_users" {
  service  = google_cloud_run_service.run_service.name
  location = google_cloud_run_service.run_service.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Display the service URL
output "service_url" {
  value = google_cloud_run_service.run_service.status[0].url
}
