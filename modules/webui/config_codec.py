import math
from copy import deepcopy
from dataclasses import dataclass
from enum import Enum
from typing import get_args, get_origin

from modules.util.config.BaseConfig import BaseConfig
from modules.util.config.SecretsConfig import SecretsConfig
from modules.util.config.TrainConfig import TrainConfig
from modules.util.type_util import issubclass_safe


@dataclass(frozen=True)
class FieldIssue:
    path: str
    message: str


class SettingsDocumentError(ValueError):
    def __init__(self, issues: list[FieldIssue]):
        super().__init__("Invalid settings document")
        self.field_issues = issues
        self.issues = [(issue.path, issue.message) for issue in issues]


def _join(path: str, name: str) -> str:
    return f"{path}.{name}" if path else name


def _validate_scalar(value: object, expected: type, nullable: bool, path: str, issues: list[FieldIssue]) -> None:
    if value is None:
        if not nullable:
            issues.append(FieldIssue(path, "Value is not nullable"))
        return
    if expected is bool:
        if type(value) is not bool:
            issues.append(FieldIssue(path, "Expected boolean"))
    elif expected is int:
        if type(value) is not int:
            issues.append(FieldIssue(path, "Expected integer"))
    elif expected is float:
        if type(value) not in (int, float):
            if value not in ("inf", "-inf"):
                issues.append(FieldIssue(path, "Expected number"))
        elif not math.isfinite(float(value)):
            issues.append(FieldIssue(path, "Expected finite number"))
    elif expected is str:
        if not isinstance(value, str):
            issues.append(FieldIssue(path, "Expected string"))
    elif issubclass_safe(expected, Enum):
        if not isinstance(value, str) or value not in expected.__members__:
            issues.append(FieldIssue(path, "Unknown enum value"))


def _validate_value(
    value: object,
    expected: type,
    nullable: bool,
    path: str,
    issues: list[FieldIssue],
    template_instance: BaseConfig | None = None,
) -> None:
    if value is None:
        if not nullable:
            issues.append(FieldIssue(path, "Value is not nullable"))
        return

    origin = get_origin(expected)

    if issubclass_safe(expected, BaseConfig):
        if not isinstance(value, dict):
            issues.append(FieldIssue(path or "$", "Expected object"))
            return
        tmpl = template_instance if template_instance is not None else expected.default_values()
        _validate_config(value, tmpl, path, issues, include_secrets=True)
    elif origin is list or expected is list:
        if not isinstance(value, list):
            issues.append(FieldIssue(path, "Expected list"))
            return
        args = get_args(expected)
        if args:
            elem_type = args[0]
            for index, item in enumerate(value):
                item_path = f"{path}.{index}"
                _validate_value(item, elem_type, False, item_path, issues)
    elif origin is dict or expected is dict:
        if not isinstance(value, dict):
            issues.append(FieldIssue(path, "Expected object"))
            return
        args = get_args(expected)
        if args and len(args) == 2:
            key_type, val_type = args
            for k, v in value.items():
                key_path = f"{path}.{k}"
                _validate_value(k, key_type, False, key_path, issues)
                _validate_value(v, val_type, False, key_path, issues)
    else:
        _validate_scalar(value, expected, nullable, path, issues)


def _validate_config(
    document: object, template: BaseConfig, path: str, issues: list[FieldIssue], include_secrets: bool
) -> None:
    if not isinstance(document, dict):
        issues.append(FieldIssue(path or "$", "Expected object"))
        return

    allowed = set(template.types)
    if not include_secrets:
        allowed.discard("secrets")
    allowed.add("__version")

    issues.extend(
        FieldIssue(_join(path, unknown), "Unknown field") for unknown in sorted(set(document) - allowed)
    )

    if "__version" not in document:
        issues.append(FieldIssue(_join(path, "__version"), "Missing field"))
    elif type(document["__version"]) is not int:
        issues.append(FieldIssue(_join(path, "__version"), "Expected integer"))

    for name, expected in template.types.items():
        if name == "secrets" and not include_secrets:
            continue
        field_path = _join(path, name)
        if name not in document:
            issues.append(FieldIssue(field_path, "Missing field"))
            continue
        value = document[name]
        nullable = template.nullables[name]
        current = getattr(template, name)

        _validate_value(value, expected, nullable, field_path, issues, template_instance=current)


def decode_settings_document(document: object, secrets: SecretsConfig) -> TrainConfig:
    issues: list[FieldIssue] = []
    template = TrainConfig.default_values()
    _validate_config(document, template, "", issues, include_secrets=False)
    if issues:
        raise SettingsDocumentError(issues)
    assert isinstance(document, dict)
    decoded = TrainConfig.default_values().from_dict(deepcopy(document), migrate=False).to_unpacked_config()
    decoded.secrets = deepcopy(secrets)
    return decoded
