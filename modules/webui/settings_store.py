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


class SettingsStoreUnreadableError(OSError):
    # Raised by setters when the existing settings file exists but cannot be
    # read or parsed, so writing would clobber unrecoverable state.
    pass


class SettingsStore:
    # Web-UI-only persisted state. Deliberately separate from TrainConfig and
    # SecretsConfig so the web UI adds no fields to shared core config classes.

    def __init__(self, path: Path):
        self._path = Path(path)

    def _read(self) -> dict[str, Any] | None:
        # Three-way result, because "no config yet" and "config I cannot read"
        # must not be conflated: has_password() gates authentication, so an
        # unreadable file has to fail closed rather than open.
        #   {}   -> the file does not exist yet
        #   dict -> parsed document
        #   None -> the file exists but could not be read or parsed
        try:
            text = self._path.read_text(encoding="utf-8")
        except FileNotFoundError:
            return {}
        except OSError:
            return None
        try:
            document = json.loads(text)
        except ValueError:
            return None
        return document if isinstance(document, dict) else None

    def _read_for_update(self) -> dict[str, Any]:
        """Document to mutate, or raise SettingsStoreUnreadableError.

        Setters must never overwrite a file whose current contents they could
        not parse -- that would silently destroy configuration (including a
        password hash), so an unreadable or corrupt file is a hard error.
        """
        document = self._read()
        if document is None:
            raise SettingsStoreUnreadableError(
                f"refusing to overwrite unreadable or malformed settings file: {self._path}"
            )
        return document

    def _write(self, document: dict[str, Any]) -> None:
        write_json_atomic(self._path, document)
        with contextlib.suppress(OSError):
            os.chmod(self._path, 0o600)

    def get_datasets_dir(self) -> str:
        """Configured datasets dir, or the default if unset/unreadable.

        Deliberately falls back rather than raising: a broken settings file
        should not take down the datasets page and the rest of the UI.
        """
        document = self._read()
        value = document.get("datasets_dir") if document is not None else None
        return value if isinstance(value, str) and value else DEFAULT_DATASETS_DIR

    def set_datasets_dir(self, path: str) -> None:
        """Persist the datasets dir. Raises SettingsStoreUnreadableError if the
        existing file exists but cannot be read or parsed."""
        document = self._read_for_update()
        document["datasets_dir"] = path
        self._write(document)

    def has_password(self) -> bool:
        """Whether a password is required to use the web UI.

        Fails closed: if the settings file exists but cannot be read or parsed,
        this returns True, so a broken file locks the UI down instead of
        disabling authentication. Only a genuinely absent file means "no
        password configured".
        """
        document = self._read()
        if document is None:
            return True
        return isinstance(document.get("password"), dict)

    def set_password(self, plaintext: str) -> None:
        """Set (or clear, when plaintext is empty) the password. Raises
        SettingsStoreUnreadableError if the existing file exists but cannot be
        read or parsed, rather than clobbering it."""
        document = self._read_for_update()
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
        """Whether plaintext matches the stored password.

        Fails closed: an unreadable or malformed settings file yields False,
        because no password can be confirmed against it.
        """
        document = self._read()
        entry = document.get("password") if document is not None else None
        if not isinstance(entry, dict):
            return False
        try:
            salt = bytes.fromhex(entry["salt"])
            expected = bytes.fromhex(entry["hash"])
        except (KeyError, TypeError, ValueError):
            return False
        return secrets.compare_digest(_derive(plaintext, salt), expected)
