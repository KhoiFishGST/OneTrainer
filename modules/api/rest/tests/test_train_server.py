import importlib.util
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[4]
SERVER_SCRIPT = REPO_ROOT / "scripts" / "train_server.py"


@pytest.fixture(scope="module")
def module():
    # Loaded by path rather than imported: scripts/ is not a package, and
    # importing it normally would run script_imports() side effects.
    import sys

    scripts_dir = str(REPO_ROOT / "scripts")
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)
    spec = importlib.util.spec_from_file_location("train_server_under_test", SERVER_SCRIPT)
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


def test_the_default_port_is_7800(module):
    assert module.parse_args([]).port == 7800


def test_the_port_is_overridable(module):
    assert module.parse_args(["--port", "9001"]).port == 9001


def test_the_host_is_loopback_and_not_configurable(module):
    # Upstream deliberately ships localhost-only: there is no --host flag, so
    # the server cannot be exposed by accident.
    assert module.HOST == "127.0.0.1"
    with pytest.raises(SystemExit):
        module.parse_args(["--host", "0.0.0.0"])
