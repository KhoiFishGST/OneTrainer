from enum import Enum
from modules.webui.schema.types import Option, Field, Group, Tab
from modules.webui.schema.codec import getattr_nested, serialize_val

class SampleEnum(Enum):
    ALPHA = "ALPHA"

def test_types_and_codec():
    opt = Option("a", "A")
    assert opt.to_dict() == {"value": "a", "label": "A"}
    assert serialize_val(SampleEnum.ALPHA) == "ALPHA"
    assert getattr_nested(SampleEnum.ALPHA, "value") == "ALPHA"
