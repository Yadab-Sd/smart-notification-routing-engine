#!/bin/bash

# Build all Java Lambda services at once
# Usage: ./build-services.sh

set -e  # Exit on any error

echo "🔨 Building all Lambda services..."
echo ""

SERVICES=(
    "control-plane"
    "events-consumer"
    "decision-service"
    "sender-service"
)

for service in "${SERVICES[@]}"; do
    echo "📦 Building $service..."
    cd "services/$service"

    # Clean and package
    mvn clean package -DskipTests

    # Copy JAR to deployment location
    mkdir -p target
    cp target/${service}-*.jar target/${service}.jar 2>/dev/null || true

    # Go back to root
    cd ../..

    echo "✅ $service built successfully"
    echo ""
done

echo "🎉 All services built successfully!"
echo ""
echo "Next steps:"
echo "  1. Deploy infrastructure: cd infra/cdk && pnpm exec cdk deploy SR-Compute"
echo "  2. Upload Glue scripts: aws s3 cp glue_jobs/build_hourly_features.py s3://YOUR_BUCKET/scripts/"
