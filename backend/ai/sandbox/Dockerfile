# Build context is backend/ (see docker_exec.py: `docker build -f
# ai/sandbox/Dockerfile backend/`), so paths below are relative to backend/.
FROM python:3.13-slim

# No .pyc caching -- the filesystem is read-only at runtime anyway, so
# writes would just fail; this avoids Python trying in the first place.
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

RUN pip install --no-cache-dir pandas

# A dedicated non-root user. Defense in depth: even if something escaped
# the container itself, it wouldn't be running as root inside it.
RUN useradd --no-create-home --uid 10001 sandbox

WORKDIR /app
COPY engine/ /app/engine/
COPY ai/sandbox/runner.py /app/runner.py
RUN chown -R sandbox:sandbox /app

USER sandbox

ENTRYPOINT ["python", "/app/runner.py"]
