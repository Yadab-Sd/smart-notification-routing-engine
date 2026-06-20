#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGION="${AWS_REGION:-${CDK_DEFAULT_REGION:-us-west-2}}"
COMPUTE_STACK="${COMPUTE_STACK:-SR-Compute}"
IDENTITY_STACK="${IDENTITY_STACK:-SR-Identity}"
FRONTEND_STACK="${FRONTEND_STACK:-SR-Frontend}"
DIST_DIR="${DIST_DIR:-dist}"

get_stack_output() {
  local stack_name="$1"
  local output_key="$2"

  aws cloudformation describe-stacks \
    --stack-name "${stack_name}" \
    --region "${REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='${output_key}'].OutputValue | [0]" \
    --output text
}

require_value() {
  local name="$1"
  local value="$2"

  if [[ -z "${value}" || "${value}" == "None" ]]; then
    echo "ERROR: Missing required value: ${name}" >&2
    exit 1
  fi
}

if ! command -v aws >/dev/null 2>&1; then
  echo "ERROR: aws CLI is required." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm is required." >&2
  exit 1
fi

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "ERROR: AWS credentials are not configured or are invalid." >&2
  echo "Run aws configure, export AWS_PROFILE, or use your organization's AWS SSO flow." >&2
  exit 1
fi

echo "Reading deployment outputs"
echo "Region: ${REGION}"

API_URL="$(get_stack_output "${COMPUTE_STACK}" "ApiUrl")"
USER_POOL_ID="$(get_stack_output "${IDENTITY_STACK}" "UserPoolId")"
CLIENT_ID="$(get_stack_output "${IDENTITY_STACK}" "UserPoolClientId")"
BUCKET_NAME="$(get_stack_output "${FRONTEND_STACK}" "BucketName")"
DIST_ID="$(get_stack_output "${FRONTEND_STACK}" "DistributionId")"
WEBSITE_URL="$(get_stack_output "${FRONTEND_STACK}" "WebsiteURL")"

require_value "ApiUrl from ${COMPUTE_STACK}" "${API_URL}"
require_value "UserPoolId from ${IDENTITY_STACK}" "${USER_POOL_ID}"
require_value "UserPoolClientId from ${IDENTITY_STACK}" "${CLIENT_ID}"
require_value "BucketName from ${FRONTEND_STACK}" "${BUCKET_NAME}"
require_value "DistributionId from ${FRONTEND_STACK}" "${DIST_ID}"

cd "${ROOT_DIR}/frontend"

echo "Installing frontend dependencies..."
npm ci

echo "Building frontend..."
VITE_API_URL="${API_URL}" \
VITE_COGNITO_USER_POOL_ID="${USER_POOL_ID}" \
VITE_COGNITO_CLIENT_ID="${CLIENT_ID}" \
VITE_REGION="${REGION}" \
VITE_DEMO_MODE="${VITE_DEMO_MODE:-false}" \
npm run build

echo "Uploading frontend assets to s3://${BUCKET_NAME}"
aws s3 sync "${DIST_DIR}/" "s3://${BUCKET_NAME}/" \
  --region "${REGION}" \
  --delete \
  --exclude "index.html" \
  --cache-control "public,max-age=31536000,immutable"

aws s3 cp "${DIST_DIR}/index.html" "s3://${BUCKET_NAME}/index.html" \
  --region "${REGION}" \
  --cache-control "no-cache,no-store,must-revalidate" \
  --content-type "text/html"

echo "Invalidating CloudFront distribution ${DIST_ID}"
aws cloudfront create-invalidation \
  --distribution-id "${DIST_ID}" \
  --paths "/*"

echo "Frontend deployed successfully"
echo "URL: ${WEBSITE_URL}"
