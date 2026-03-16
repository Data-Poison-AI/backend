# Use an official Python runtime with Node.js included since the backend runs on Node but executes Python scripts
FROM nikolaik/python-nodejs:python3.11-nodejs20

WORKDIR /app

# ---- 1. Install AI Dependencies first (heavy, they change less) ----
WORKDIR /ai
# Context is now root directory
COPY ai/requirements.txt ./
# We need to install rust and cargo to build tokenizers from source if needed
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies for the AI script
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# Return to backend work directory
WORKDIR /app

# ---- 2. Install Node.js Dependencies ----
COPY backend/package*.json ./
RUN npm install

# ---- 3. Copy Application Code ----
COPY backend/ .

# Expose port
EXPOSE 3000

# Start Application
CMD ["npm", "run", "dev"]
