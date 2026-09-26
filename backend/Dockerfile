# Multi-stage production build for FastAPI backend

FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated non-root application user
RUN groupadd -g 10001 appuser && \
    useradd -u 10001 -g appuser -s /bin/sh -d /app appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Ensure entrypoint is executable and owned by appuser
RUN chmod +x /app/entrypoint.sh && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# Health check using python urllib against /health endpoint
# Uses $PORT env var so it works on both Render (dynamic port) and fixed port deployments
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request, sys, os; port = os.environ.get('PORT', '8000'); sys.exit(0 if urllib.request.urlopen(f'http://localhost:{port}/health', timeout=3).getcode() == 200 else 1)"

ENTRYPOINT ["/app/entrypoint.sh"]
# Render dynamically provides the PORT environment variable.
# The entrypoint wrapper respects $PORT at runtime.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
