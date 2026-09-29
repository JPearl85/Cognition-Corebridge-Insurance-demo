# main.tf — Three Rivers Insurance: Azure infrastructure definitions
# Architecture: App Service (Java/Spring Boot) + Static Web App (React) + PostgreSQL

# --- Resource Group ---
# Central container for all Three Rivers Insurance resources
resource "azurerm_resource_group" "main" {
  name     = "${var.resource_group_name}-${var.environment}"
  location = var.location

  tags = {
    project     = "three-rivers-insurance"
    environment = var.environment
    managed_by  = "terraform"
  }
}

# --- App Service Plan ---
# Linux plan hosting the Spring Boot backend
resource "azurerm_service_plan" "backend" {
  name                = "tri-backend-plan-${var.environment}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  os_type             = "Linux"
  sku_name            = var.app_service_sku

  tags = azurerm_resource_group.main.tags
}

# --- App Service (Spring Boot Backend) ---
# Java 21 Linux web app for the insurance quote API
resource "azurerm_linux_web_app" "backend" {
  name                = "tri-backend-${var.environment}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  service_plan_id     = azurerm_service_plan.backend.id

  site_config {
    application_stack {
      java_server         = "JAVA"
      java_server_version = "21"
      java_version        = "21"
    }

    always_on = var.environment == "prod" ? true : false
  }

  # Database connection string injected as an app setting
  app_settings = {
    "SPRING_DATASOURCE_URL"      = "jdbc:postgresql://${azurerm_postgresql_flexible_server.main.fqdn}:5432/insurance?sslmode=require"
    "SPRING_DATASOURCE_USERNAME" = var.db_admin_username
    "SPRING_DATASOURCE_PASSWORD" = var.db_admin_password
  }

  tags = azurerm_resource_group.main.tags
}

# --- Static Web App (React Frontend) ---
# Azure Static Web Apps for the React SPA with built-in CI/CD support
resource "azurerm_static_web_app" "frontend" {
  name                = "tri-frontend-${var.environment}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku_tier            = var.environment == "prod" ? "Standard" : "Free"
  sku_size            = var.environment == "prod" ? "Standard" : "Free"

  tags = azurerm_resource_group.main.tags
}

# --- PostgreSQL Flexible Server ---
# Managed PostgreSQL for insurance quote data persistence
resource "azurerm_postgresql_flexible_server" "main" {
  name                   = "tri-postgres-${var.environment}"
  location               = azurerm_resource_group.main.location
  resource_group_name    = azurerm_resource_group.main.name
  version                = var.postgresql_version
  administrator_login    = var.db_admin_username
  administrator_password = var.db_admin_password
  storage_mb             = var.postgresql_storage_mb
  sku_name               = var.postgresql_sku

  # Dev environments use zone-redundant HA disabled to save cost
  zone = "1"

  tags = azurerm_resource_group.main.tags
}

# --- PostgreSQL Database ---
# The application database on the flexible server
resource "azurerm_postgresql_flexible_server_database" "insurance" {
  name      = "insurance"
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# --- PostgreSQL Firewall Rule ---
# Allow Azure services to connect (for App Service → PostgreSQL)
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure" {
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}
