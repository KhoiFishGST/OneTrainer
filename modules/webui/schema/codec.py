import math
from enum import Enum

from modules.util.config.BaseConfig import BaseConfig
from modules.util.type_util import issubclass_safe as _issubclass_safe


def issubclass_safe(x: object, t: type) -> bool:
    return _issubclass_safe(x, t)


def serialize_val(val: object) -> object:
    if isinstance(val, Enum):
        return val.value
    if isinstance(val, BaseConfig):
        return val.to_dict()
    if isinstance(val, float) and math.isinf(val):
        return "-inf" if val < 0 else "inf"
    if isinstance(val, list):
        return [serialize_val(x) for x in val]
    if isinstance(val, dict):
        return {k: serialize_val(v) for k, v in val.items()}
    return val


def getattr_nested(obj: object, path: str) -> object:
    curr = obj
    for part in path.split("."):
        if curr is None:
            return None
        if isinstance(curr, Enum):
            return curr.value if hasattr(curr, "value") else str(curr)
        curr = curr.get(part) if isinstance(curr, dict) else getattr(curr, part, None)
    if isinstance(curr, Enum):
        return curr.value if hasattr(curr, "value") else str(curr)
    return curr
