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
        nullable = any(config_template.nullables.get(k, False) for k in self.keys)

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
        parts = first_key.split(".")
        if len(parts) == 2 and parts[0] in config_template.types:
            sub_cls = config_template.types[parts[0]]
            if hasattr(sub_cls, "default_values"):
                sub_defaults = sub_cls.default_values()
                key_type = sub_defaults.types.get(parts[1])
        else:
            key_type = config_template.types.get(first_key)

        if key_type is not None and isinstance(key_type, type) and issubclass_safe(key_type, Enum):
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
