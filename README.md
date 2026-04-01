

#### For any /infra/cdk changes
```angular2html
pnpm install
<!-- on every changes run: -->
pnpm exec cdk synth
pnpm exec cdk deploy SR-ML
```

#### For any /services changes
```angular2html
<!-- on every changes run: -->
mvn -q -DskipTests package
mkdir -p target && cp target/control-plane-1.0.0.jar target/control-plane.zip
```

## ML Problem Formulation

Two small models (train nightly):
1. ### Send‑Time Model: For each (userId, localHour), estimate P(click | send at hour H).
- Algo: XGBoost classification, label from historical sends/clicks.
- Inference: pick argmax hour within campaign window that doesn’t violate quiet hours.

2. ### Channel Model: Multiclass (email / whatsapp / push / in‑app) predicting best channel for a given user+campaign.
- Algo: XGBoost multiclass or LightGBM.

### Evaluation
- AUC‑PR, Calibration (ECE), Top‑1 accuracy for channel model.
- Uplift vs baseline (uniform send‑time & channel) via A/B experiments.

## Training Pipeline (batch)

**Orchestration:** EventBridge nightly @ 02:00 local.

1. Extract: Glue job reads last N days of events & deliveries from S3 raw/ and deliveries/.
2. Transform: Build per‑user hourly panels (features + labels). Write to S3 curated/features/… and update SageMaker Feature Store.
3. Train: SageMaker Training Job (Docker + Python) runs XGBoost; outputs model.tar.gz to S3 models/send_time/v1/… and models/channel/v1/….
4. Register: SageMaker Model Registry with versioning & metrics; require min AUC‑PR before promote.
5. Deploy: Blue/green to SageMaker Real‑Time Endpoint (or Serverless Inference for low cost).


Schemas:
Event - {"userId":567,"type":"PLAY_MOVIE","ts":"2025-10-11T07:00:00Z","attrs":{"device":"mobile"}}
UserProfile DDB: {pk: String, sk:String, counters: {events:number}, lastSeenAt: timestamp

Curated S3 CSV - 0,14,0.0,2 // x, hour, x, number of events


NB: Comment out SageMakerStack in app.ts for the first deployment and until you train
<img width="2100" height="1700" alt="Smart Notification Routing Engine drawio (2)" src="https://github.com/user-attachments/assets/84cf8db4-8aa3-4319-8420-714feef593c0" />

AWS Sagemaker XGBoost Image - https://github.com/aws/sagemaker-xgboost-container?tab=readme-ov-file
