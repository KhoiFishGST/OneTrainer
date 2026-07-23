from modules.util.enum.ModelType import ModelType
from modules.util.enum.TrainingMethod import TrainingMethod
from modules.webui.schema.types import Field, Group, Tab


def build_general_tab(model_type: ModelType, training_method: TrainingMethod) -> Tab:
    return Tab(
        "general",
        "General",
        (
            Group(
                "workspace",
                "Workspace",
                (
                    Field(
                        "workspace-dir",
                        ("workspace_dir",),
                        "Workspace Directory",
                        "The directory where all files of this training run are saved",
                        "directory",
                        path_mode="directory",
                    ),
                    Field(
                        "cache-dir",
                        ("cache_dir",),
                        "Cache Directory",
                        "The directory where cached data is saved",
                        "directory",
                        path_mode="directory",
                    ),
                    Field(
                        "continue-backup",
                        ("continue_last_backup",),
                        "Continue from last backup",
                        "Automatically continues training from the last backup saved in <workspace>/backup",
                        "toggle",
                    ),
                    Field(
                        "only-cache",
                        ("only_cache",),
                        "Only Cache",
                        "Only populate the cache, without any training",
                        "toggle",
                    ),
                    Field(
                        "prevent-overwrites",
                        ("prevent_overwrites",),
                        "Prevent Overwrites",
                        "When enabled, output paths that already exist on disk will be flagged as invalid to avoid accidental overwrites",
                        "toggle",
                    ),
                ),
            ),
            Group(
                "debug",
                "Debug",
                (
                    Field(
                        "debug-mode",
                        ("debug_mode",),
                        "Debug mode",
                        "Save debug information during the training into the debug directory",
                        "toggle",
                    ),
                    Field(
                        "debug-dir",
                        ("debug_dir",),
                        "Debug Directory",
                        "The directory where debug data is saved",
                        "directory",
                        path_mode="directory",
                    ),
                ),
            ),
            Group(
                "tensorboard",
                "TensorBoard",
                (
                    Field(
                        "tensorboard",
                        ("tensorboard",),
                        "Tensorboard",
                        "Starts the Tensorboard Web UI during training",
                        "toggle",
                    ),
                    Field(
                        "tensorboard-always",
                        ("tensorboard_always_on",),
                        "Always-On Tensorboard",
                        "Keep Tensorboard accessible even when not training. Useful for monitoring completed training sessions.",
                        "toggle",
                    ),
                    Field(
                        "tensorboard-expose",
                        ("tensorboard_expose",),
                        "Expose Tensorboard",
                        "Exposes Tensorboard Web UI to all network interfaces (makes it accessible from the network)",
                        "toggle",
                    ),
                    Field(
                        "tensorboard-port",
                        ("tensorboard_port",),
                        "Tensorboard Port",
                        "Port to use for Tensorboard link",
                        "number",
                    ),
                ),
            ),
            Group(
                "validation",
                "Validation",
                (
                    Field(
                        "validation",
                        ("validation",),
                        "Validation",
                        "Enable validation steps and add new graph in tensorboard",
                        "toggle",
                    ),
                    Field(
                        "validate-after",
                        ("validate_after", "validate_after_unit"),
                        "Validate after",
                        "The interval used when validate training",
                        "time",
                    ),
                ),
            ),
            Group(
                "devices",
                "Devices",
                (
                    Field(
                        "dataloader-threads",
                        ("dataloader_threads",),
                        "Dataloader Threads",
                        "Number of threads used for the data loader. Increase if your GPU has room during caching, decrease if it's going out of memory during caching.",
                        "number",
                        required=True,
                    ),
                    Field(
                        "train-device",
                        ("train_device",),
                        "Train Device",
                        'The device used for training. Can be "cuda", "cuda:0", "cuda:1" etc. Default:"cuda". Must be "cuda" for multi-GPU training.',
                        "text",
                        required=True,
                    ),
                    Field(
                        "async-offloading",
                        ("async_offloading",),
                        "Async Offloading",
                        "Overlaps CPU<->GPU transfers with computation using CUDA streams. Applies to every offloaded component",
                        "toggle",
                    ),
                    Field(
                        "multi-gpu",
                        ("multi_gpu",),
                        "Multi-GPU",
                        "Enable multi-GPU training",
                        "toggle",
                    ),
                    Field(
                        "device-indexes",
                        ("device_indexes",),
                        "Device Indexes",
                        'Multi-GPU: A comma-separated list of device indexes. If empty, all your GPUs are used. With a list such as "0,1,3,4" you can omit a GPU, for example an on-board graphics GPU.',
                        "text",
                    ),
                    Field(
                        "gradient-reduce-precision",
                        ("gradient_reduce_precision",),
                        "Gradient Reduce Precision",
                        "WEIGHT_DTYPE: Reduce gradients between GPUs in your weight data type; can be imprecise, but more efficient than float32\nWEIGHT_DTYPE_STOCHASTIC: Sum up the gradients in your weight data type, but average them in float32 and stochastically round if your weight data type is bfloat16\nFLOAT_32: Reduce gradients in float32\nFLOAT_32_STOCHASTIC: Reduce gradients in float32; use stochastic rounding to bfloat16 if your weight data type is bfloat16",
                        "select",
                    ),
                    Field(
                        "fused-gradient-reduce",
                        ("fused_gradient_reduce",),
                        "Fused Gradient Reduce",
                        "Multi-GPU: Gradient synchronisation during the backward pass. Can be more efficient, especially with Async Gradient Reduce",
                        "toggle",
                    ),
                    Field(
                        "async-gradient-reduce",
                        ("async_gradient_reduce",),
                        "Async Gradient Reduce",
                        "Multi-GPU: Asynchroniously start the gradient reduce operations during the backward pass. Can be more efficient, but requires some VRAM.",
                        "toggle",
                    ),
                    Field(
                        "async-gradient-buffer",
                        ("async_gradient_reduce_buffer",),
                        "Buffer size (MB)",
                        'Multi-GPU: Maximum VRAM for "Async Gradient Reduce", in megabytes. A multiple of this value can be needed if combined with "Fused Back Pass" and/or "Layer offload fraction"',
                        "number",
                    ),
                    Field(
                        "temp-device",
                        ("temp_device",),
                        "Temp Device",
                        'The device used to temporarily offload models while they are not used. Default:"cpu"',
                        "text",
                    ),
                ),
            ),
        ),
    )
