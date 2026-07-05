# ADR 0003: Use SageMaker XGBoost With Fallback Heuristic

## Status

Accepted

## Context

The system needs a send-time model, but new adopters may not have enough event
data or SageMaker quota available on day one. The runtime should not fail just
because the ML endpoint is not ready.

## Decision

Use SageMaker XGBoost for trained send-time prediction when the endpoint is
available. Use a deterministic fallback heuristic when SageMaker is unavailable.

Runtime responses expose the source:

```text
modelSource = SAGEMAKER
modelSource = FALLBACK_HEURISTIC
```

## Consequences

Benefits:

- first deployment works without a trained endpoint
- adopters can see when predictions are startup estimates
- the same Decision Service path works before and after model deployment
- SageMaker can be introduced gradually as data matures

Tradeoffs:

- fallback estimates are not personalized trained predictions
- model-quality claims require real adopter data
- training jobs can fail if data, quotas, or IAM are not ready
- the UI and docs must clearly distinguish fallback from trained model output

