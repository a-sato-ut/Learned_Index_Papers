FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock /app/
RUN uv sync --no-dev

COPY . /app

CMD ["uv", "run", "uvicorn", "process_data:app", "--host", "0.0.0.0", "--port", "8080"]
