#!/bin/bash
set -e

echo "Starting Zero-Downtime Deployment..."

# Navigate to the project directory
cd "$(dirname "$0")/.."

# Ensure Nginx config is present (for first deployment)
if [ ! -f "nginx/nginx.conf" ]; then
    echo "Nginx configuration not found! Make sure to copy it."
    exit 1
fi

# Start Nginx proxy if it is not already running
if ! docker ps | grep -q "projet_i_nginx"; then
    echo "Starting Nginx Proxy container..."
    docker-compose -f docker-compose.nginx.yml up -d
fi

# Check which environment is currently active in Nginx (blue or green)
if grep -q "127.0.0.1:3000" nginx/nginx.conf; then
    CURRENT_ENV="blue"
    NEW_ENV="green"
    API_PORT=3003
    APP_PORT=3002
else
    CURRENT_ENV="green"
    NEW_ENV="blue"
    API_PORT=3001
    APP_PORT=3000
fi

echo "Current environment is $CURRENT_ENV. Deploying to $NEW_ENV (App:$APP_PORT, API:$API_PORT)."

# Export ports for docker-compose based on the target environment
export API_PORT=$API_PORT
export APP_PORT=$APP_PORT
export NEXT_PUBLIC_API_URL="/api"

# Build and start the new environment
echo "Building and starting $NEW_ENV environment..."
docker-compose -p projet_i_$NEW_ENV up -d --build

echo "Waiting 10 seconds for containers to initialize..."
sleep 10

# Healthcheck
echo "Performing healthcheck on $NEW_ENV environment..."
# We check if the ports are responding to HTTP GET requests
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$API_PORT/ || true)
APP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$APP_PORT/ || true)

# If either container returns 000 (Connection refused/timeout), the healthcheck fails.
# Since we didn't hardcode a specific /health route on the backend, any HTTP status means the server is up.
if [ "$API_STATUS" = "000" ] || [ "$APP_STATUS" = "000" ]; then
    echo "Healthcheck FAILED. API Status: $API_STATUS, App Status: $APP_STATUS"
    echo "Rolling back! Stopping newly deployed $NEW_ENV environment..."
    docker-compose -p projet_i_$NEW_ENV down
    exit 1
else
    echo "Healthcheck PASSED. API Status: $API_STATUS, App Status: $APP_STATUS"
fi

# Update Nginx Configuration to switch traffic
echo "Routing traffic to $NEW_ENV..."
if [ "$NEW_ENV" = "green" ]; then
    sed -i 's/127.0.0.1:3000/127.0.0.1:3002/g' nginx/nginx.conf
    sed -i 's/127.0.0.1:3001/127.0.0.1:3003/g' nginx/nginx.conf
else
    sed -i 's/127.0.0.1:3002/127.0.0.1:3000/g' nginx/nginx.conf
    sed -i 's/127.0.0.1:3003/127.0.0.1:3001/g' nginx/nginx.conf
fi

# Reload Nginx (Zero-Downtime reload)
echo "Reloading Nginx Proxy..."
docker exec projet_i_nginx nginx -s reload

# Clean up old environment
if docker ps -a | grep -q "projet_i_$CURRENT_ENV"; then
    echo "Stopping old $CURRENT_ENV environment..."
    docker-compose -p projet_i_$CURRENT_ENV down
fi

echo "Deployment to $NEW_ENV completed successfully in Zero-Downtime!"
