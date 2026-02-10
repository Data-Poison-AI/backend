import cv2
import numpy as np
from PIL import Image

def extract_features(image_path):
    img = Image.open(image_path).convert("RGB")
    img = img.resize((256, 256))
    img_np = np.array(img)

    gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)

    features = []

    # 1. Media y desviación
    features.append(np.mean(gray))
    features.append(np.std(gray))

    # 2. Entropía (ruido)
    hist = cv2.calcHist([gray],[0],None,[256],[0,256])
    hist = hist / hist.sum()
    entropy = -np.sum(hist * np.log2(hist + 1e-7))
    features.append(entropy)

    # 3. Laplacian variance (textura / perturbaciones)
    lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    features.append(lap_var)

    # 4. FFT energy (frecuencias altas sospechosas)
    f = np.fft.fft2(gray)
    fshift = np.fft.fftshift(f)
    magnitude = np.abs(fshift)
    features.append(np.mean(magnitude))

    return np.array(features)
