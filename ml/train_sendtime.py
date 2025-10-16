# smart-router/ml/training/train_sendtime.py
import os
import joblib
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import average_precision_score

def load_parquet_dir(path):
    import pyarrow.parquet as pq
    import glob
    files = glob.glob(f"{path}/*.parquet")
    if not files:
        raise RuntimeError("No parquet files in " + path)
    df = pd.concat([pq.read_table(f).to_pandas() for f in files], ignore_index=True)
    return df

if __name__ == "__main__":
    train_dir = os.environ.get("SM_CHANNEL_TRAIN", "/opt/ml/input/data/train")
    model_dir = os.environ.get("SM_MODEL_DIR", "/opt/ml/model")
    df = load_parquet_dir(train_dir)
    X = df[['sends_count_hour','click_rate_7d']].fillna(0)
    y = df['label'].astype(int)
    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)
    model = xgb.XGBClassifier(max_depth=6, n_estimators=200, learning_rate=0.05, use_label_encoder=False, eval_metric='logloss')
    model.fit(X_train, y_train, eval_set=[(X_val,y_val)], verbose=False)
    preds = model.predict_proba(X_val)[:,1]
    ap = average_precision_score(y_val, preds)
    print("validation_ap:", ap)
    joblib.dump(model, os.path.join(model_dir, "model.joblib"))
