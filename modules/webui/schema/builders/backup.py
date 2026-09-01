from modules.util.enum.ModelType import ModelType
from modules.util.enum.TrainingMethod import TrainingMethod
from modules.webui.schema.types import Field, Group, Tab


def build_backup_tab(model_type: ModelType, training_method: TrainingMethod) -> Tab:
    return Tab(
        "backup",
        "Backup",
        (
            Group(
                "backup",
                "Backup and save",
                (
                    Field(
                        "backup-after",
                        ("backup_after", "backup_after_unit"),
                        "Backup After",
                        "The interval used when automatically creating model backups during training",
                        "time",
                    ),
                    Field(
                        "rolling-backup",
                        ("rolling_backup",),
                        "Rolling Backup",
                        "If rolling backups are enabled, older backups are deleted automatically",
                        "toggle",
                    ),
                    Field(
                        "rolling-count",
                        ("rolling_backup_count",),
                        "Rolling Backup Count",
                        "Defines the number of backups to keep if rolling backups are enabled",
                        "number",
                    ),
                    Field(
                        "backup-before-save",
                        ("backup_before_save",),
                        "Backup Before Save",
                        "Create a full backup before saving the final model",
                        "toggle",
                    ),
                    Field(
                        "save-every",
                        ("save_every", "save_every_unit"),
                        "Save Every",
                        "The interval used when automatically saving the model during training",
                        "time",
                    ),
                    Field(
                        "save-skip-first",
                        ("save_skip_first",),
                        "Skip First",
                        "Start saving automatically after this interval has elapsed",
                        "number",
                    ),
                    Field(
                        "save-prefix",
                        ("save_filename_prefix",),
                        "Save Filename Prefix",
                        "The prefix for filenames used when saving the model during training",
                        "text",
                    ),
                ),
            ),
        ),
    )
