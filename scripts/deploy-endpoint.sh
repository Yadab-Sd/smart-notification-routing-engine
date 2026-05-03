#!/bin/bash
#
# Deploy SageMaker endpoint with a specific trained model
# Usage: ./scripts/deploy-endpoint.sh [model-path]
#
# Examples:
#   ./scripts/deploy-endpoint.sh training-output/send-time-abc123/output/model.tar.gz
#   ./scripts/deploy-endpoint.sh latest  (uses the most recent model)
#

set -e

REGION="us-west-2"

# Get Lambda function name
echo "Finding endpoint deployer Lambda..."
LAMBDA_NAME=$(aws lambda list-functions --region ${REGION} \
    --query "Functions[?contains(FunctionName, 'EndpointDeployerFn')].FunctionName" \
    --output text)

if [ -z "$LAMBDA_NAME" ]; then
    echo "❌ Error: Endpoint deployer Lambda not found. Deploy SR-ML stack first."
    exit 1
fi

echo "✅ Found Lambda: ${LAMBDA_NAME}"

# Get models bucket
MODELS_BUCKET=$(aws cloudformation describe-stacks --stack-name SR-Data --region ${REGION} \
    --query "Stacks[0].Outputs[?OutputKey=='ModelsBucketName'].OutputValue" --output text)

echo "✅ Models bucket: ${MODELS_BUCKET}"

# Determine model path
if [ -z "$1" ]; then
    echo ""
    echo "Available models:"
    aws s3 ls s3://${MODELS_BUCKET}/training-output/ --recursive | grep model.tar.gz | tail -10
    echo ""
    echo "Usage: $0 <model-path>"
    echo "   or: $0 latest"
    exit 1
elif [ "$1" == "latest" ]; then
    echo "🔍 Finding latest model..."
    MODEL_PATH=$(aws s3 ls s3://${MODELS_BUCKET}/training-output/ --recursive | grep model.tar.gz | tail -1 | awk '{print $4}')
    if [ -z "$MODEL_PATH" ]; then
        echo "❌ No trained models found in S3"
        exit 1
    fi
    echo "✅ Latest model: ${MODEL_PATH}"
else
    MODEL_PATH="$1"
    echo "✅ Using model: ${MODEL_PATH}"
fi

MODEL_S3_URL="s3://${MODELS_BUCKET}/${MODEL_PATH}"

# Verify model exists
if ! aws s3 ls "${MODEL_S3_URL}" > /dev/null 2>&1; then
    echo "❌ Error: Model not found at ${MODEL_S3_URL}"
    exit 1
fi

echo "✅ Model verified: ${MODEL_S3_URL}"
echo ""

# Invoke Lambda
echo "🚀 Deploying endpoint..."

# Create timestamp for unique job name
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Create payload JSON file
cat > /tmp/deploy-payload.json <<PAYLOAD
{
  "TrainingJobName": "manual-deployment-${TIMESTAMP}",
  "ModelArtifacts": {
    "S3ModelArtifacts": "${MODEL_S3_URL}"
  }
}
PAYLOAD

# Invoke Lambda with payload from file
aws lambda invoke \
    --function-name ${LAMBDA_NAME} \
    --region ${REGION} \
    --cli-binary-format raw-in-base64-out \
    --payload file:///tmp/deploy-payload.json \
    /tmp/deploy-response.json

echo ""
echo "📋 Deployment Response:"
cat /tmp/deploy-response.json | jq '.'

echo ""
echo "✅ Endpoint deployment initiated!"
echo ""
echo "Monitor status with:"
echo "  aws sagemaker describe-endpoint --endpoint-name send-time-v1 --region ${REGION} --query EndpointStatus"
echo ""
echo "Or visit AWS Console:"
echo "  https://us-west-2.console.aws.amazon.com/sagemaker/home?region=us-west-2#/endpoints/send-time-v1"
