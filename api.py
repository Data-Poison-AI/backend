from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import joblib
import tempfile
from features import extract_features

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # para DEMO
    allow_methods=["*"],
    allow_headers=["*"],
)

model = joblib.load("model.pkl")

@app.post("/analyze")
async def analyze_image(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp.write(await file.read())
        path = tmp.name

    features = extract_features(path).reshape(1, -1)
    prob = model.predict_proba(features)[0][1]

    return {
        "risk_score": round(float(prob * 100), 2),
        "label": "suspicious" if prob > 0.5 else "clean"
    }
