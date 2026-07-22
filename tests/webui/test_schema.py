from modules.webui.schema import PHASE_A_KEYS, SchemaRegistry

import pytest

EXPECTED_KEYS = {
    "workspace_dir",
    "cache_dir",
    "continue_last_backup",
    "only_cache",
    "prevent_overwrites",
    "debug_mode",
    "debug_dir",
    "tensorboard",
    "tensorboard_always_on",
    "tensorboard_expose",
    "tensorboard_port",
    "validation",
    "validate_after",
    "validate_after_unit",
    "dataloader_threads",
    "train_device",
    "async_offloading",
    "multi_gpu",
    "device_indexes",
    "gradient_reduce_precision",
    "fused_gradient_reduce",
    "async_gradient_reduce",
    "async_gradient_reduce_buffer",
    "temp_device",
    "aspect_ratio_bucketing",
    "latent_caching",
    "clear_cache_before_training",
    "backup_after",
    "backup_after_unit",
    "rolling_backup",
    "rolling_backup_count",
    "backup_before_save",
    "save_every",
    "save_every_unit",
    "save_skip_first",
    "save_filename_prefix",
}

EXPECTED_FIELD_METADATA = {
    "workspace-dir": (
        "Workspace Directory",
        "The directory where all files of this training run are saved",
    ),
    "cache-dir": ("Cache Directory", "The directory where cached data is saved"),
    "continue-backup": (
        "Continue from last backup",
        "Automatically continues training from the last backup saved in <workspace>/backup",
    ),
    "only-cache": ("Only Cache", "Only populate the cache, without any training"),
    "prevent-overwrites": (
        "Prevent Overwrites",
        "When enabled, output paths that already exist on disk will be flagged as invalid to avoid accidental overwrites",
    ),
    "debug-mode": (
        "Debug mode",
        "Save debug information during the training into the debug directory",
    ),
    "debug-dir": ("Debug Directory", "The directory where debug data is saved"),
    "tensorboard": ("Tensorboard", "Starts the Tensorboard Web UI during training"),
    "tensorboard-always": (
        "Always-On Tensorboard",
        "Keep Tensorboard accessible even when not training. Useful for monitoring completed training sessions.",
    ),
    "tensorboard-expose": (
        "Expose Tensorboard",
        "Exposes Tensorboard Web UI to all network interfaces (makes it accessible from the network)",
    ),
    "tensorboard-port": ("Tensorboard Port", "Port to use for Tensorboard link"),
    "validation": (
        "Validation",
        "Enable validation steps and add new graph in tensorboard",
    ),
    "validate-after": (
        "Validate after",
        "The interval used when validate training",
    ),
    "dataloader-threads": (
        "Dataloader Threads",
        "Number of threads used for the data loader. Increase if your GPU has room during caching, decrease if it's going out of memory during caching.",
    ),
    "train-device": (
        "Train Device",
        'The device used for training. Can be "cuda", "cuda:0", "cuda:1" etc. Default:"cuda". Must be "cuda" for multi-GPU training.',
    ),
    "async-offloading": (
        "Async Offloading",
        "Overlaps CPU<->GPU transfers with computation using CUDA streams. Applies to every offloaded component",
    ),
    "multi-gpu": ("Multi-GPU", "Enable multi-GPU training"),
    "device-indexes": (
        "Device Indexes",
        'Multi-GPU: A comma-separated list of device indexes. If empty, all your GPUs are used. With a list such as "0,1,3,4" you can omit a GPU, for example an on-board graphics GPU.',
    ),
    "gradient-reduce-precision": (
        "Gradient Reduce Precision",
        "WEIGHT_DTYPE: Reduce gradients between GPUs in your weight data type; can be imprecise, but more efficient than float32\nWEIGHT_DTYPE_STOCHASTIC: Sum up the gradients in your weight data type, but average them in float32 and stochastically round if your weight data type is bfloat16\nFLOAT_32: Reduce gradients in float32\nFLOAT_32_STOCHASTIC: Reduce gradients in float32; use stochastic rounding to bfloat16 if your weight data type is bfloat16",
    ),
    "fused-gradient-reduce": (
        "Fused Gradient Reduce",
        "Multi-GPU: Gradient synchronisation during the backward pass. Can be more efficient, especially with Async Gradient Reduce",
    ),
    "async-gradient-reduce": (
        "Async Gradient Reduce",
        "Multi-GPU: Asynchroniously start the gradient reduce operations during the backward pass. Can be more efficient, but requires some VRAM.",
    ),
    "async-gradient-buffer": (
        "Buffer size (MB)",
        'Multi-GPU: Maximum VRAM for "Async Gradient Reduce", in megabytes. A multiple of this value can be needed if combined with "Fused Back Pass" and/or "Layer offload fraction"',
    ),
    "temp-device": (
        "Temp Device",
        'The device used to temporarily offload models while they are not used. Default:"cpu"',
    ),
    "aspect-ratio": (
        "Aspect Ratio Bucketing",
        "Aspect ratio bucketing enables training on images with different aspect ratios",
    ),
    "latent-caching": (
        "Latent Caching",
        "Caching of intermediate training data that can be re-used between epochs",
    ),
    "clear-cache": (
        "Clear cache before training",
        "Clears the cache directory before starting to train. Only disable this if you want to continue using the same cached data. Disabling this can lead to errors, if other settings are changed during a restart",
    ),
    "backup-after": (
        "Backup After",
        "The interval used when automatically creating model backups during training",
    ),
    "rolling-backup": (
        "Rolling Backup",
        "If rolling backups are enabled, older backups are deleted automatically",
    ),
    "rolling-count": (
        "Rolling Backup Count",
        "Defines the number of backups to keep if rolling backups are enabled",
    ),
    "backup-before-save": (
        "Backup Before Save",
        "Create a full backup before saving the final model",
    ),
    "save-every": (
        "Save Every",
        "The interval used when automatically saving the model during training",
    ),
    "save-skip-first": (
        "Skip First",
        "Start saving automatically after this interval has elapsed",
    ),
    "save-prefix": (
        "Save Filename Prefix",
        "The prefix for filenames used when saving the model during training",
    ),
}


def test_phase_a_schema_has_exact_native_field_keys():
    assert PHASE_A_KEYS == EXPECTED_KEYS
    schema = SchemaRegistry().build("STABLE_DIFFUSION_15", "FINE_TUNE")
    actual = {
        key
        for tab in schema["tabs"]
        for group in tab["groups"]
        for field in group["fields"]
        for key in field["keys"]
    }
    assert actual == EXPECTED_KEYS


def test_schema_paths_are_unique_and_have_tooltips():
    schema = SchemaRegistry().build("STABLE_DIFFUSION_15", "FINE_TUNE")
    fields = [
        field
        for tab in schema["tabs"]
        for group in tab["groups"]
        for field in group["fields"]
    ]
    ids = [field["id"] for field in fields]
    assert len(ids) == len(set(ids))
    assert all(field["label"] and field["tooltip"] for field in fields)


def test_schema_field_labels_and_tooltips_match_expected():
    schema = SchemaRegistry().build("STABLE_DIFFUSION_15", "FINE_TUNE")
    fields = [
        field
        for tab in schema["tabs"]
        for group in tab["groups"]
        for field in group["fields"]
    ]
    actual_metadata = {field["id"]: (field["label"], field["tooltip"]) for field in fields}
    assert actual_metadata == EXPECTED_FIELD_METADATA


def test_schema_rejects_unsupported_model_method_pair():
    with pytest.raises(ValueError, match="Training method is not supported"):
        SchemaRegistry().build("FLUX_DEV_1", "FINE_TUNE_VAE")


def test_meta_serializes_model_method_and_enum_values():
    meta = SchemaRegistry().meta()
    sd15 = next(
        model for model in meta["model_types"] if model["value"] == "STABLE_DIFFUSION_15"
    )
    assert sd15["label"] == "SD1.5"
    assert {method["value"] for method in sd15["training_methods"]} >= {
        "FINE_TUNE",
        "LORA",
        "EMBEDDING",
    }
    assert "MINUTE" in meta["enums"]["TimeUnit"]
