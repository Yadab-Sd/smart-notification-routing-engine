#!/usr/bin/env bash

set -euo pipefail

REGION="${AWS_REGION:-${CDK_DEFAULT_REGION:-us-west-2}}"
FRONTEND_STACK="${FRONTEND_STACK:-SR-Frontend}"
PATHS="${1:-/*}"

get_stack_output() {
  local stack_name="$1"
  local output_key="$2"

  aws cloudformation describe-stacks \
    --stack-name "${stack_name}" \
    --region "${REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='${output_key}'].OutputValue | [0]" \
    --output text
}

if ! command -v aws >/dev/null 2>&1; then
  echo "ERROR: aws CLI is required." >&2
  exit 1
fi

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "ERROR: AWS credentials are not configured or are invalid." >&2
  exit 1
fi

DIST_ID="$(get_stack_output "${FRONTEND_STACK}" "DistributionId")"

if [[ -z "${DIST_ID}" || "${DIST_ID}" == "None" ]]; then
  echo "ERROR: Could not find DistributionId output in ${FRONTEND_STACK}." >&2
  exit 1
fi

echo "Creating CloudFront invalidation"
echo "Distribution: ${DIST_ID}"
echo "Paths: ${PATHS}"

aws cloudfront create-invalidation \
  --distribution-id "${DIST_ID}" \
  --paths "${PATHS}"
