"""Idempotent local credentials and TLS setup; never reads the banking .env."""
import os
import secrets
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent
target = root / ".env"
if not target.exists():
    text = (root / ".env.example").read_text()
    for key in ("AI_EVAL_DB_ADMIN_PASSWORD", "AI_EVALUATION_RUNTIME_PASSWORD", "AI_EVALUATION_API_KEY", "AI_EVALUATION_PEER_API_KEY"):
        text = text.replace(key + "=\n", key + "=" + secrets.token_hex(32) + "\n")
    sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    text = text.replace("GIT_COMMIT_SHA=\n", "GIT_COMMIT_SHA=" + sha + "\n")
    descriptor = os.open(target, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(descriptor, "w") as stream:
        stream.write(text)
pki = root / ".local-pki"
pki.mkdir(exist_ok=True, mode=0o700)
if not (pki / "ca.crt").exists():
    subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-sha256", "-days", "30", "-nodes",
                    "-keyout", str(pki / "ca.key"), "-out", str(pki / "ca.crt"), "-subj", "/CN=llm-gateway",
                    "-addext", "subjectAltName=DNS:llm-gateway"], check=True, capture_output=True)
    (pki / "ca.key").chmod(0o600)
print("Local evaluation credentials and TLS prepared. Edit evaluations/safelabs/.env to opt into a real model.")
