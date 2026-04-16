#!/usr/bin/env bash
set -euo pipefail

echo "=== Clorn Setup ==="
echo ""

# Check prerequisites
for cmd in docker; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: $cmd is not installed."
    exit 1
  fi
done

if ! docker compose version &>/dev/null; then
  echo "Error: docker compose is not available."
  exit 1
fi

# Create .env if it doesn't exist
if [ ! -f .env ]; then
  echo "Creating .env file..."
  echo ""

  read -rp "Discord Bot Token: " DISCORD_TOKEN
  read -rp "Discord Client ID: " DISCORD_CLIENT_ID
  read -rp "Anthropic API Key: " ANTHROPIC_API_KEY
  read -rp "Claude Model [claude-sonnet-4-6]: " CLAUDE_MODEL
  CLAUDE_MODEL=${CLAUDE_MODEL:-claude-sonnet-4-6}

  # Generate encryption key
  ENCRYPTION_KEY=$(openssl rand -hex 32)
  # Generate postgres password
  POSTGRES_PASSWORD=$(openssl rand -hex 16)

  cat > .env <<EOF
DISCORD_TOKEN=${DISCORD_TOKEN}
DISCORD_CLIENT_ID=${DISCORD_CLIENT_ID}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
CLAUDE_MODEL=${CLAUDE_MODEL}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DATABASE_URL=postgresql://clorn:${POSTGRES_PASSWORD}@db:5432/clorn
EOF

  echo ""
  echo ".env created with auto-generated ENCRYPTION_KEY and POSTGRES_PASSWORD."
else
  echo ".env already exists, skipping."
fi

echo ""
echo "Building and starting containers..."
docker compose up -d --build

echo ""
echo "=== Setup complete ==="
echo "Bot is running. Check logs with: docker compose logs -f bot"
echo "Stop with: docker compose down"
