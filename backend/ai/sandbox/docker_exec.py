from __future__ import annotations

import json
import subprocess
import uuid

IMAGE_NAME = "ai-backtester-sandbox"
TIMEOUT_SECONDS = 20

# What actually makes this safe to run untrusted code:
#   --network none            no network access at all -- can't exfiltrate
#                              data or download anything, regardless of what
#                              the code tries.
#   --memory / --cpus         bounds resource use; a runaway loop or memory
#   --pids-limit               leak can't starve the host or fork-bomb.
#   --read-only                 the container's root filesystem is immutable;
#                              nothing written by the code persists or can
#                              tamper with the image.
#   --tmpfs /tmp                a small, memory-backed, non-executable
#                              scratch space -- some libraries want *a*
#                              writable /tmp even if this app doesn't.
#   --security-opt              blocks privilege escalation via setuid
#     no-new-privileges         binaries (defense in depth; the image has
#                              none, but this costs nothing to also set).
# The non-root user is baked into the image itself (Dockerfile's USER),
# rather than a runtime flag, since it's a property of what the container
# *is*, not how it's invoked.
DOCKER_RUN_FLAGS = [
    "--network",
    "none",
    "--memory",
    "256m",
    "--cpus",
    "1",
    "--pids-limit",
    "64",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=64m",
    "--security-opt",
    "no-new-privileges",
]


class SandboxExecutionError(RuntimeError):
    """The strategy code failed to run cleanly inside the sandbox -- a
    Python exception in the generated code, a timeout, or the container
    itself failing to start. The message is what gets fed back to Claude in
    the codegen retry loop, so it's kept close to the raw error."""


def run_in_sandbox(strategy_code: str, bars: list[dict], initial_equity: float) -> dict:
    """Run one strategy against one dataset inside a fresh, ephemeral
    container. Blocks for the duration of the run (a handful of seconds at
    most for a normal backtest) -- there's no async story here because the
    codegen retry loop that calls this is itself a sequential "try, see if
    it worked, try again" process.
    """
    payload = json.dumps({"strategy_code": strategy_code, "bars": bars, "initial_equity": initial_equity})
    container_name = f"ai-backtester-sandbox-{uuid.uuid4().hex[:12]}"

    try:
        proc = subprocess.run(
            ["docker", "run", "--rm", "-i", "--name", container_name, *DOCKER_RUN_FLAGS, IMAGE_NAME],
            input=payload,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as exc:
        # subprocess's own timeout kills the `docker run` CLI process, but
        # that doesn't stop the container the daemon is still running --
        # the CLI is just a client. Explicitly kill it by name so a timed-
        # out strategy doesn't keep burning CPU in the background.
        subprocess.run(["docker", "kill", container_name], capture_output=True)
        raise SandboxExecutionError(
            f"Strategy execution timed out after {TIMEOUT_SECONDS}s (likely an infinite loop)."
        ) from exc

    if proc.returncode != 0:
        raise SandboxExecutionError(f"Sandbox container failed (exit {proc.returncode}): {proc.stderr[-2000:]}")

    try:
        result = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise SandboxExecutionError(f"Sandbox produced unparseable output: {proc.stdout[-2000:]}") from exc

    if not result.get("ok"):
        raise SandboxExecutionError(result.get("error", "Unknown sandbox error."))

    return result
