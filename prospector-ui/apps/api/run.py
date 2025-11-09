"""Run script for the FastAPI server.

Run with: uv run python run.py
Or: source .venv/bin/activate && python run.py
"""

import uvicorn
from app.core import settings


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.api_reload,
        log_level=settings.log_level,
    )
