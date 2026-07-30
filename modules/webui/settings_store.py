import contextlib
import hashlib
import json
import os
import secrets
from pathlib import Path
from typing import Any

from modules.webui.atomic_io import write_json_atomic

DEFAULT_DATASETS_DIR = "training_datasets"

_SCRYPT_N = 2 ** 14
_SCRYPT_R = 8
_SCRYPT_P = 1
_SCRYPT_DKLEN = 32
_SALT_BYTES = 16


def _derive(plaintext: str, salt: bytes) -> bytes:
    return hashlib.scrypt(
        plaintext.encode("utf-8"),
        salt=salt,
        n=_SCRYPT_N,
        r=_SCRYPT_R,
        p=_SCRYPT_P,
        dklen=_SCRYPT_DKLEN,
    )


class SettingsStore:
    # Web-UI-only persisted state. Deliberately separate from TrainConfig and
    # SecretsConfig so the web UI adds no fields to shared core config classes.

    def __init__(self, path: Path):
        self._path = Path(path)

    def _read(self) -> dict[str, Any]:
        try:
            document = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}
        return document if isinstance(document, dict) else {}

    def _write(self, document: dict[str, Any]) -> None:
        write_json_atomic(self._path, document)
        with contextlib.suppress(OSError):
            os.chmod(self._path, 0o600)

    def get_datasets_dir(self) -> str:
        value = self._read().get("datasets_dir")
        return value if isinstance(value, str) and value else DEFAULT_DATASETS_DIR

    def set_datasets_dir(self, path: str) -> None:
        document = self._read()
        document["datasets_dir"] = path
        self._write(document)

    def has_password(self) -> bool:
        return isinstance(self._read().get("password"), dict)

    def set_password(self, plaintext: str) -> None:
        document = self._read()
        if not plaintext:
            document["password"] = None
        else:
            salt = secrets.token_bytes(_SALT_BYTES)
            document["password"] = {
                "salt": salt.hex(),
                "hash": _derive(plaintext, salt).hex(),
            }
        self._write(document)

    def verify_password(self, plaintext: str) -> bool:
        entry = self._read().get("password")
        if not isinstance(entry, dict):
            return False
        try:
            salt = bytes.fromhex(entry["salt"])
            expected = bytes.fromhex(entry["hash"])
        except (KeyError, TypeError, ValueError):
            return False
        return secrets.compare_digest(_derive(plaintext, salt), expected)
