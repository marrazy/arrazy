FROM python:3.14-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
 
WORKDIR /app
 
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1
 
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
 
COPY src ./src
 
RUN useradd --create-home app
USER app
 
EXPOSE 8000
CMD ["uvicorn", "api.app:app", "--app-dir", "src", "--host", "0.0.0.0", "--port", "8000"]