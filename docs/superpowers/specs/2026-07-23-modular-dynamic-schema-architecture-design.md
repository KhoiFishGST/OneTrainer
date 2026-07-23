# Design Spec: Modular Dynamic Schema Architecture

## Executive Summary

To achieve 100% UI parity with native OneTrainer across all model presets and future-proof the Web UI, we are refactoring the schema subsystem into a modular package with per-tab builder modules. Every tab will be dynamically constructed using a uniform builder function signature `build_<tab>_tab(model_type: ModelType, training_method: TrainingMethod) -> Tab`.

---

## 1. Package Structure & Architecture

We will organize the schema subsystem under `modules/webui/schema/`:

```
modules/webui/schema/
├── __init__.py           # Package exports (SchemaRegistry, Field, Group, Tab, build_schema)
├── types.py              # Dataclasses: Field, Group, Tab, Option
├── codec.py              # Schema helpers: getattr_nested, serialize_val, issubclass_safe
├── registry.py           # SchemaRegistry dispatch & enum/metadata exports
└── builders/             # Per-tab builder package
    ├── __init__.py       # Builder registry & dispatcher map
    ├── model.py          # build_model_tab(model_type, training_method)
    ├── training.py       # build_training_tab(model_type, training_method)
    ├── sampling.py       # build_sampling_tab(model_type, training_method)
    ├── lora_embedding.py # build_lora_embedding_tab(model_type, training_method)
    ├── general.py        # build_general_tab(model_type, training_method)
    ├── data.py           # build_data_tab(model_type, training_method)
    ├── cloud.py          # build_cloud_tab(model_type, training_method)
    ├── backup.py         # build_backup_tab(model_type, training_method)
    └── secrets.py        # build_secrets_tab(model_type, training_method)
```

---

## 2. Uniform Builder Interface & Dispatcher

### 2.1 Function Contract
Every tab builder module implements the uniform signature:
```python
def build_<tab_name>_tab(model_type: ModelType, training_method: TrainingMethod) -> Tab:
    ...
```

### 2.2 Central Dispatch Table (`builders/__init__.py`)
```python
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

### 2.3 Schema Compilation & Coverage
- `SchemaRegistry.build(model_type, training_method)` iterates over `TAB_BUILDERS` and calls each builder.
- `SchemaRegistry.get_all_field_names()` evaluates all `ModelType` and `TrainingMethod` combinations to ensure 100% test coverage.

---

## 3. Backward Compatibility & Verification

- `modules/webui/schema/__init__.py` re-exports all public symbols (`SchemaRegistry`, `Field`, `Group`, `Tab`, `Option`, `getattr_nested`, `serialize_val`, `issubclass_safe`, `PHASE_A_KEYS`).
- All existing imports continue working without modification.
