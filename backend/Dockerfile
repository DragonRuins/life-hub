FROM python:3.12-slim

WORKDIR /app

# Install dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Production: gunicorn with 2 workers
# Dev override: docker-compose.yml sets `command: python run.py` for hot-reload
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "run:app"]
