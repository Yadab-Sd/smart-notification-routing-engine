# train.py (SageMaker)
import xgboost as xgb, pandas as pd
from sklearn.metrics import average_precision_score
from joblib import dump


train = pd.read_parquet('/opt/ml/input/data/train')
X = train.drop(columns=['label'])
y = train['label']


model = xgb.XGBClassifier(max_depth=6, n_estimators=300, learning_rate=0.05, subsample=0.8)
model.fit(X, y)


pred = model.predict_proba(X)[:,1]
print('train_ap', average_precision_score(y, pred))


dump(model, '/opt/ml/model/model.joblib')