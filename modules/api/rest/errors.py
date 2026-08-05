class ApiError(Exception):
    """Base for every error this API reports.

    Subclasses set error_type/status_code; app.py has a single handler that
    turns any ApiError into the envelope from error_envelope().
    """

    error_type = "internal"
    status_code = 500

    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class InvalidConfigError(ApiError):
    error_type = "invalid_config"
    status_code = 422


class ConflictError(ApiError):
    error_type = "conflict"
    status_code = 409

    def __init__(self, message: str, run_id: str):
        super().__init__(message, {"run_id": run_id})


class NoActiveRunError(ApiError):
    error_type = "no_active_run"
    status_code = 409


def error_envelope(error_type: str, message: str, details: dict | None = None) -> dict:
    return {"error": {"type": error_type, "message": message, "details": details or {}}}
