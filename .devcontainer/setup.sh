#!/bin/bash
# .devcontainer/setup.sh - Setup script for codespace development environment.

set -e

echo "=== Starting Dev Container Setup ==="

# 1. Install root dependencies
echo "Installing root npm dependencies..."
npm install

# 2. Install frontend dependencies
if [ -d "frontend" ]; then
  echo "Installing frontend npm dependencies..."
  npm install --prefix frontend
fi

# 3. Check and install Google Cloud CLI (gcloud)
if ! command -v gcloud &> /dev/null; then
  echo "Google Cloud CLI (gcloud) not found. Installing..."
  
  INSTALL_DIR="/usr/local/share"
  
  # Check if we have sudo access, otherwise install to $HOME
  if sudo -n true 2>/dev/null; then
    echo "Using system-wide installation via sudo..."
    curl -sSL https://sdk.cloud.google.com > /tmp/gcloud-install.sh
    sudo bash /tmp/gcloud-install.sh --disable-prompts --install-dir="$INSTALL_DIR"
    rm -f /tmp/gcloud-install.sh
    
    # Symlink binaries to /usr/local/bin which is in the standard system PATH
    sudo ln -sf "$INSTALL_DIR/google-cloud-sdk/bin/gcloud" /usr/local/bin/gcloud
    sudo ln -sf "$INSTALL_DIR/google-cloud-sdk/bin/gsutil" /usr/local/bin/gsutil
    sudo ln -sf "$INSTALL_DIR/google-cloud-sdk/bin/bq" /usr/local/bin/bq
  else
    echo "Sudo not available. Installing to user home directory..."
    curl -sSL https://sdk.cloud.google.com > /tmp/gcloud-install.sh
    bash /tmp/gcloud-install.sh --disable-prompts --install-dir="$HOME"
    rm -f /tmp/gcloud-install.sh
    
    # Add to shell profile files for PATH persistence
    for profile in "$HOME/.bashrc" "$HOME/.zshrc"; do
      if [ -f "$profile" ]; then
        if ! grep -q "google-cloud-sdk" "$profile"; then
          echo "Adding gcloud to $profile path..."
          echo "source \$HOME/google-cloud-sdk/path.bash.inc" >> "$profile"
          echo "source \$HOME/google-cloud-sdk/completion.bash.inc" >> "$profile"
        fi
      fi
    done
  fi
  
  echo "Google Cloud CLI installation completed."
else
  echo "Google Cloud CLI is already installed."
fi

# 4. Setup Antigravity CLI settings/permissions
echo "Setting up Antigravity CLI settings..."
mkdir -p "$HOME/.gemini/antigravity-cli"
if [ -f "/workspaces/google-cloud-summit-2026/.devcontainer/settings.json" ]; then
  # Symlink the settings so any in-session permission updates sync back to the repo
  ln -sf "/workspaces/google-cloud-summit-2026/.devcontainer/settings.json" "$HOME/.gemini/antigravity-cli/settings.json"
  echo "Linked .devcontainer/settings.json to $HOME/.gemini/antigravity-cli/settings.json"
fi

echo "=== Dev Container Setup Completed Successfully ==="

