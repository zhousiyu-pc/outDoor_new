FROM python:3.12-slim AS runtime
WORKDIR /app
COPY requirements.lock.txt ./requirements.lock.txt
RUN pip install --no-cache-dir --requirement requirements.lock.txt

FROM runtime AS verify
WORKDIR /workspace
COPY app ./app
COPY tests ./tests
COPY skills ./skills
RUN RUN_AGENT_HTTP_TESTS=1 PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s tests -v

FROM runtime
WORKDIR /app
ENV PORT=19081
ENV HOST=0.0.0.0
ENV APP_ENV=production
ENV AGENT_DEMO_MODE=false
ENV AGENT_DEADLINE_MS=1000
COPY --from=verify /workspace/app ./app
COPY --from=verify /workspace/skills ./skills
EXPOSE 19081
CMD ["python", "app/server.py"]
