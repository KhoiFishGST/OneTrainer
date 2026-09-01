from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from modules.util.config.TrainConfig import TrainConfig


@dataclass(frozen=True)
class Option:
    value: str
    label: str

    def to_dict(self) -> dict[str, object]:
        return {"value": self.value, "label": self.label}


@dataclass(frozen=True)
class Field:
    id: str
    keys: tuple[str, ...]
    label: str
    tooltip: str
    control: str
    path_mode: str | None = None
    required: bool = False

    def to_dict(self, config_template: "TrainConfig") -> dict[str, object]:
        from modules.webui.schema.codec import getattr_nested, issubclass_safe, serialize_val

        first_key = self.keys[0]

        def _is_key_nullable(k: str) -> bool:
            parts = k.split(".")
            if len(parts) == 1:
                return config_template.nullables.get(k, True)
            elif len(parts) == 2 and parts[0] in config_template.types:
                sub_cls = config_template.types[parts[0]]
                if hasattr(sub_cls, "default_values"):
                    sub_defaults = sub_cls.default_values()
                    return sub_defaults.nullables.get(parts[1], True)
            return True

        nullable = any(_is_key_nullable(k) for k in self.keys)

        if len(self.keys) == 1:
            raw_val = getattr_nested(config_template, first_key)
            default_val = serialize_val(raw_val)
        else:
            default_val = []
            for k in self.keys:
                raw_val = getattr_nested(config_template, k)
                default_val.append(serialize_val(raw_val))

        options = None
        key_type = None
        for k in self.keys:
            parts = k.split(".")
            if len(parts) == 2 and parts[0] in config_template.types:
                sub_cls = config_template.types[parts[0]]
                if hasattr(sub_cls, "default_values"):
                    sub_defaults = sub_cls.default_values()
                    kt = sub_defaults.types.get(parts[1])
                else:
                    kt = None
            else:
                kt = config_template.types.get(k)

            if kt is not None and isinstance(kt, type) and issubclass_safe(kt, Enum):
                key_type = kt
                break

        if key_type is not None and isinstance(key_type, type) and issubclass_safe(key_type, Enum):
            from modules.util.enum.TimeUnit import TimeUnit
            if issubclass_safe(key_type, TimeUnit):
                unit_labels = {
                    "SECOND": "Seconds",
                    "MINUTE": "Minutes",
                    "HOUR": "Hours",
                    "EPOCH": "Epochs",
                    "STEP": "Steps",
                    "NEVER": "Never",
                    "ALWAYS": "Always",
                }
                options = [{"value": e.value, "label": unit_labels.get(e.value, e.value.capitalize())} for e in key_type]
            else:
                options = [{"value": e.value, "label": e.value} for e in key_type]

        res: dict[str, object] = {
            "id": self.id,
            "keys": list(self.keys),
            "label": self.label,
            "tooltip": self.tooltip,
            "control": self.control,
            "required": self.required,
            "nullable": nullable,
            "default": default_val,
        }
        if self.path_mode is not None:
            res["path_mode"] = self.path_mode
        if options is not None:
            res["options"] = options
        return res


@dataclass(frozen=True)
class Group:
    id: str
    label: str
    fields: tuple[Field, ...]

    def to_dict(self, config_template: "TrainConfig") -> dict[str, object]:
        return {
            "id": self.id,
            "label": self.label,
            "fields": [field.to_dict(config_template) for field in self.fields],
        }


@dataclass(frozen=True)
class Tab:
    id: str
    label: str
    groups: tuple[Group, ...]

    def to_dict(self, config_template: "TrainConfig") -> dict[str, object]:
        return {
            "id": self.id,
            "label": self.label,
            "groups": [group.to_dict(config_template) for group in self.groups],
        }
