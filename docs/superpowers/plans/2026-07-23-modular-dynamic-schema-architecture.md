# Modular Dynamic Schema Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Web UI schema subsystem into a modular package `modules/webui/schema/` with independent per-tab builder modules in `builders/` exposing uniform signatures `build_<tab>_tab(model_type, training_method)` to guarantee 100% native UI parity and future-proofing.

**Architecture:** Split the monolithic schema into dataclasses (`types.py`), serialization codec helpers (`codec.py`), tab builders (`builders/*.py`), a central tab dispatcher (`builders/__init__.py`), and a backward-compatible package shim (`schema/__init__.py`).

**Tech Stack:** Python 3.12, Dataclasses, Pytest, SvelteKit, Bun.

## Global Constraints

- **Package Shim**: `modules/webui/schema/__init__.py` MUST re-export `SchemaRegistry`, `Field`, `Group`, `Tab`, `Option`, `getattr_nested`, `serialize_val`, `issubclass_safe`, `PHASE_A_KEYS` so existing imports remain 100% untouched.
- **Uniform Signatures**: All tab builder functions MUST have signature `build_<tab>_tab(model_type: ModelType, training_method: TrainingMethod) -> Tab`.

---

### Task 1: Package Types & Codec Extraction

**Files:**
- Create: `modules/webui/schema/types.py`
- Create: `modules/webui/schema/codec.py`
- Test: `tests/webui/test_schema.py`

**Interfaces:**
- Produces: `Option`, `Field`, `Group`, `Tab` in `types.py`; `serialize_val`, `getattr_nested`, `issubclass_safe` in `codec.py`.

- [ ] **Step 1: Write failing test for types and codec in `tests/webui/test_types_codec.py`**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. /home/khoifish/GST/gst-venv/bin/pytest tests/webui/test_types_codec.py -v`
Expected: FAIL (module not found)

- [ ] **Step 3: Create `modules/webui/schema/types.py`**

```python
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
```

- [ ] **Step 4: Create `modules/webui/schema/codec.py`**

```python
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
        if isinstance(curr, dict):
            curr = curr.get(part)
        else:
            curr = getattr(curr, part, None)
    if isinstance(curr, Enum):
        return curr.value if hasattr(curr, "value") else str(curr)
    return curr
```

- [ ] **Step 5: Run test to verify it passes**

Run: `PYTHONPATH=. /home/khoifish/GST/gst-venv/bin/pytest tests/webui/test_types_codec.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add modules/webui/schema/types.py modules/webui/schema/codec.py tests/webui/test_types_codec.py
git commit -m "refactor(webui): extract schema types and codec module"
```

---

### Task 2: Implement Tab Builders Subpackage

**Files:**
- Create: `modules/webui/schema/builders/__init__.py`
- Create: `modules/webui/schema/builders/general.py`
- Create: `modules/webui/schema/builders/model.py`
- Create: `modules/webui/schema/builders/training.py`
- Create: `modules/webui/schema/builders/sampling.py`
- Create: `modules/webui/schema/builders/lora_embedding.py`
- Create: `modules/webui/schema/builders/data.py`
- Create: `modules/webui/schema/builders/cloud.py`
- Create: `modules/webui/schema/builders/backup.py`
- Create: `modules/webui/schema/builders/secrets.py`

**Interfaces:**
- Consumes: `Field`, `Group`, `Tab` from `modules.webui.schema.types`; `ModelType`, `TrainingMethod` from `modules.util.enum.*`.
- Produces: `build_general_tab`, `build_model_tab`, `build_training_tab`, `build_sampling_tab`, `build_lora_embedding_tab`, `build_data_tab`, `build_cloud_tab`, `build_backup_tab`, `build_secrets_tab` with uniform signatures `(model_type: ModelType, training_method: TrainingMethod) -> Tab`.

- [ ] **Step 1: Create builder files**
  - Implement each builder function with signature `def build_<tab>_tab(model_type: ModelType, training_method: TrainingMethod) -> Tab:` in its dedicated file.

- [ ] **Step 2: Create `modules/webui/schema/builders/__init__.py`**

```python
from typing import Callable
from modules.util.enum.ModelType import ModelType
from modules.util.enum.TrainingMethod import TrainingMethod
from modules.webui.schema.types import Tab
from modules.webui.schema.builders.general import build_general_tab
from modules.webui.schema.builders.model import build_model_tab
from modules.webui.schema.builders.training import build_training_tab
from modules.webui.schema.builders.sampling import build_sampling_tab
from modules.webui.schema.builders.lora_embedding import build_lora_embedding_tab
from modules.webui.schema.builders.data import build_data_tab
from modules.webui.schema.builders.cloud import build_cloud_tab
from modules.webui.schema.builders.backup import build_backup_tab
from modules.webui.schema.builders.secrets import build_secrets_tab

TAB_BUILDERS: list[tuple[str, Callable[[ModelType, TrainingMethod], Tab]]] = [
    ("general", build_general_tab),
    ("model", build_model_tab),
    ("training", build_training_tab),
    ("sampling", build_sampling_tab),
    ("lora_embedding", build_lora_embedding_tab),
    ("data", build_data_tab),
    ("cloud", build_cloud_tab),
    ("backup", build_backup_tab),
    ("secrets", build_secrets_tab),
]
```

- [ ] **Step 3: Test builder module loading**

Run: `PYTHONPATH=. /home/khoifish/GST/gst-venv/bin/python3 -c "from modules.webui.schema.builders import TAB_BUILDERS; print(len(TAB_BUILDERS))"`
Expected: `9`

- [ ] **Step 4: Commit**

```bash
git add modules/webui/schema/builders/
git commit -m "feat(webui): implement per-tab dynamic builders package"
```

---

### Task 3: Implement SchemaRegistry & Re-export Shim

**Files:**
- Create: `modules/webui/schema/registry.py`
- Create: `modules/webui/schema/__init__.py`
- Modify: Replace `modules/webui/schema.py` file with `modules/webui/schema/` directory.

**Interfaces:**
- Produces: `SchemaRegistry` and package re-exports matching existing API.

- [ ] **Step 1: Create `modules/webui/schema/registry.py`**
  - Implement `SchemaRegistry` with `build(model_type, training_method)`, `get_all_field_names()`, `meta()`, and sub-schema lookup helpers.

- [ ] **Step 2: Create `modules/webui/schema/__init__.py`**

```python
from modules.webui.schema.types import Field, Group, Tab, Option
from modules.webui.schema.codec import getattr_nested, serialize_val, issubclass_safe
from modules.webui.schema.registry import SchemaRegistry, OPTIMIZER_SUB_SCHEMAS, SCHEDULER_SUB_SCHEMAS, PHASE_A_KEYS

__all__ = [
    "Field",
    "Group",
    "Tab",
    "Option",
    "getattr_nested",
    "serialize_val",
    "issubclass_safe",
    "SchemaRegistry",
    "OPTIMIZER_SUB_SCHEMAS",
    "SCHEDULER_SUB_SCHEMAS",
    "PHASE_A_KEYS",
]
```

- [ ] **Step 3: Remove old `modules/webui/schema.py` file**

Run: `git rm modules/webui/schema.py`

- [ ] **Step 4: Run Pytest test suite**

Run: `PYTHONPATH=. /home/khoifish/GST/gst-venv/bin/pytest tests/webui/test_schema.py tests/webui/test_schema_coverage.py -v`
Expected: 6 PASSED

- [ ] **Step 5: Run Vitest frontend tests**

Run: `cd web && bun run test`
Expected: 102 PASSED across 21 test files

- [ ] **Step 6: Build Web UI bundle**

Run: `cd web && bun run build`
Expected: Production build success

- [ ] **Step 7: Commit**

```bash
git add modules/webui/schema/
git commit -m "refactor(webui): complete modular dynamic schema architecture refactoring"
```
