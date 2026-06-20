#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGION="${AWS_REGION:-${CDK_DEFAULT_REGION:-us-west-2}}"

echo "Deploying SNRE infrastructure"
echo "Region: ${REGION}"

if ! command -v aws >/dev/null 2>&1; then
  echo "ERROR: aws CLI is required." >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "ERROR: pnpm is required. Install it with: npm install -g pnpm" >&2
  exit 1
fi

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "ERROR: AWS credentials are not configured or are invalid." >&2
  echo "Run aws configure, export AWS_PROFILE, or use your organization's AWS SSO flow." >&2
  exit 1
fi

cd "${ROOT_DIR}"

echo "Building Lambda service artifacts..."
./scripts/build-services.sh

cd "${ROOT_DIR}/infra/cdk"

echo "Installing CDK dependencies..."
pnpm install --frozen-lockfile

if [[ "${SKIP_BOOTSTRAP:-false}" != "true" ]]; then
  echo "Bootstrapping CDK environment..."
  pnpm exec cdk bootstrap
fi

if [[ "$#" -gt 0 ]]; then
  echo "Deploying selected stack(s): $*"
  pnpm exec cdk deploy "$@" --require-approval never
else
  echo "Deploying data prerequisites..."
  pnpm exec cdk deploy SR-Security SR-Data --require-approval never

  echo "Uploading Glue feature engineering script..."
  MODELS_BUCKET="$(aws cloudformation describe-stacks \
    --stack-name SR-Data \
    --region "${REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='ModelsBucketName'].OutputValue | [0]" \
    --output text)"

  if [[ -z "${MODELS_BUCKET}" || "${MODELS_BUCKET}" == "None" ]]; then
    echo "ERROR: Could not find ModelsBucketName output in SR-Data." >&2
    exit 1
  fi

  aws s3 cp "${ROOT_DIR}/glue-jobs/build_hourly_features.py" \
    "s3://${MODELS_BUCKET}/scripts/build_hourly_features.py" \
    --region "${REGION}"

  echo "Deploying all stacks..."
  pnpm exec cdk deploy --all --require-approval never
fi
