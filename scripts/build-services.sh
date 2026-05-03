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
    "endpoint-deployer"
)

for service in "${SERVICES[@]}"; do
    echo "📦 Building $service..."
    cd "services/$service"

    # Clean and package
    mvn clean package -DskipTests

    # Find the generated JAR (usually named service-name-version.jar)
    jar_file=$(find target -maxdepth 1 -name "*.jar" -not -name "*-sources.jar" -not -name "*-javadoc.jar" -not -name "original-*.jar" | head -n 1)

    if [ -z "$jar_file" ]; then
        echo "❌ Error: Could not find JAR file for $service"
        exit 1
    fi

    # Copy with consistent naming: service-name.jar
    cp "$jar_file" "target/${service}.jar"

    echo "✅ $service built successfully → target/${service}.jar"
    echo ""

    # Go back to root
    cd ../..
done

echo "🎉 All services built successfully!"
echo ""
echo "📁 Generated deployment files:"
echo "  - services/control-plane/target/control-plane.jar"
echo "  - services/events-consumer/target/events-consumer.jar"
echo "  - services/decision-service/target/decision-service.jar"
echo "  - services/sender-service/target/sender-service.jar"
echo "  - services/endpoint-deployer/target/endpoint-deployer.jar"
echo ""
echo "Note: These JAR files are what the CDK deployment will use to create Lambda functions."
echo ""
echo "Next steps:"
echo "  1. Deploy Lambda functions: cd infra/cdk && pnpm exec cdk deploy SR-Compute"
echo "  2. Deploy ML pipeline: cd infra/cdk && pnpm exec cdk deploy SR-ML"
