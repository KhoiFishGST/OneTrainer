from modules.api.rest.ApiError import (
    ApiError,
    ConflictError,
    InvalidConfigError,
    NoActiveRunError,
)


def test_envelope_has_a_single_error_key_with_type_message_and_details():
    assert InvalidConfigError("bad", {"path": "epochs"}).envelope() == {
        "error": {
            "type": "invalid_config",
            "message": "bad",
            "details": {"path": "epochs"},
        }
    }


def test_envelope_defaults_details_to_an_empty_dict():
    assert ApiError("boom").envelope()["error"]["details"] == {}


def test_base_error_is_a_500_internal():
    err = ApiError("boom")
    assert err.status_code == 500
    assert err.error_type == "internal"
    assert err.message == "boom"
    assert err.details == {}


def test_invalid_config_is_a_422():
    err = InvalidConfigError("nope")
    assert (err.status_code, err.error_type) == (422, "invalid_config")


def test_no_active_run_is_a_409():
    err = NoActiveRunError("nothing running")
    assert (err.status_code, err.error_type) == (409, "no_active_run")


def test_conflict_carries_the_active_run_id_in_details():
    # A client that lost track of its run must be able to recover without guessing.
    err = ConflictError("already running", run_id="abc123")
    assert (err.status_code, err.error_type) == (409, "conflict")
    assert err.details == {"run_id": "abc123"}
