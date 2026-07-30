from pathlib import Path

from scripts.train_ui_web import exposure_warning, make_settings, parse_args, validate_static_build

import pytest


def test_web_entry_defaults_to_loopback_7801() -> None:
    args = parse_args([])
    assert (args.host, args.port, args.dev) == ("127.0.0.1", 7801, False)


def test_production_requires_build_but_dev_does_not(tmp_path: Path) -> None:
    settings = make_settings(tmp_path, dev=False)
    with pytest.raises(SystemExit, match="Frontend build is missing"):
        validate_static_build(settings)
    validate_static_build(make_settings(tmp_path, dev=True))


def test_network_exposure_warning_is_explicit() -> None:
    assert exposure_warning("127.0.0.1") is None
    assert exposure_warning("0.0.0.0") == "Web UI has no authentication and is exposed to the network"
