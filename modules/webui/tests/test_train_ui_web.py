from pathlib import Path

from scripts.train_ui_web import (
    exposure_warning,
    make_settings,
    parse_args,
    startup_banner,
    validate_static_build,
)

import pytest


def test_web_entry_defaults_to_loopback_7801() -> None:
    args = parse_args([])
    assert (args.host, args.port, args.dev) == ("127.0.0.1", 7801, False)


def test_production_requires_build_but_dev_does_not(tmp_path: Path) -> None:
    settings = make_settings(tmp_path, dev=False)
    with pytest.raises(SystemExit, match="Frontend build is missing"):
        validate_static_build(settings)
    validate_static_build(make_settings(tmp_path, dev=True))


def test_no_exposure_warning_when_bound_to_loopback() -> None:
    for host in ("127.0.0.1", "localhost", "::1"):
        assert exposure_warning(host, has_password=False) is None


def test_exposure_warning_names_what_is_reachable() -> None:
    # A bare "no authentication" line does not convey that this hands out the
    # Hugging Face token and a filesystem browser, so it must be specific.
    warning = exposure_warning("0.0.0.0", has_password=False)

    assert warning is not None
    assert "no password" in warning.lower()
    for exposed in ("Hugging Face token", "upload", "Settings"):
        assert exposed in warning


def test_no_exposure_warning_once_a_password_is_set() -> None:
    # The old warning claimed "no authentication" for every non-loopback bind,
    # including one that is in fact authenticated -- which trains people to
    # ignore it.
    assert exposure_warning("0.0.0.0", has_password=True) is None


def test_loopback_banner_says_how_to_reach_it_from_another_device() -> None:
    # The whole point: a new user cannot discover --host from a URL alone.
    banner = startup_banner("127.0.0.1", 7801)

    assert "http://127.0.0.1:7801" in banner
    assert "--host 0.0.0.0" in banner
    assert "Only this machine" in banner


def test_exposed_banner_does_not_advertise_the_flag_again() -> None:
    banner = startup_banner("0.0.0.0", 7801)

    assert "--host 0.0.0.0" not in banner
    # 0.0.0.0 is not a URL anyone can open, so the banner must not print it as one.
    assert "http://0.0.0.0" not in banner
    assert "every network interface" in banner


def test_banner_reports_a_non_default_port() -> None:
    assert "http://127.0.0.1:9000" in startup_banner("127.0.0.1", 9000)
