import json
from pathlib import Path
from typing import Any

from modules.util.config.SampleConfig import SampleConfig
from modules.util.config.TrainConfig import TrainConfig
from modules.util.enum.EMAMode import EMAMode
from modules.webui.atomic_io import write_json_atomic
from modules.webui.gallery import (
    GalleryService,
    TrainingProgressSnapshot,
)

import pytest


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    ws = tmp_path / "workspace"
    ws.mkdir(parents=True, exist_ok=True)
    return ws


@pytest.fixture
def train_config() -> TrainConfig:
    return TrainConfig.default_values()


@pytest.fixture
def gallery(tmp_path: Path, workspace: Path) -> GalleryService:
    return GalleryService(root_dir=tmp_path, workspace_provider=lambda: workspace)


def progress(step: int = 0, epoch: int = 1, epoch_step: int = 0) -> TrainingProgressSnapshot:
    return TrainingProgressSnapshot(epoch=epoch, epoch_step=epoch_step, global_step=step)


def sample_definition(webui_id: str, **kwargs: Any) -> dict[str, Any]:
    return {"webui_id": webui_id, "prompt": "a", **kwargs}


def write_core_config(workspace: Path, filename: str, content: str = "{}") -> Path:
    config_file = workspace / "config" / filename
    config_file.parent.mkdir(parents=True, exist_ok=True)
    config_file.write_text(content, encoding="utf-8")
    return config_file


@pytest.fixture
def core_config(workspace: Path) -> Any:
    def _create(filename: str = "prefix-2026-07-26_11-17-26.json", content: str = "{}") -> Path:
        return write_core_config(workspace, filename, content)

    return _create


def read_manifest(gallery: GalleryService) -> dict[str, Any]:
    assert gallery.active_run_dir is not None
    manifest_path = gallery.active_run_dir / "manifest.json"
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def read_prompts(gallery: GalleryService) -> dict[str, Any]:
    assert gallery.active_run_dir is not None
    prompts_path = gallery.active_run_dir / "prompts.json"
    return json.loads(prompts_path.read_text(encoding="utf-8"))


def first_revision_prompt(prompts_doc: dict[str, Any]) -> dict[str, Any]:
    revisions = prompts_doc.get("revisions", {})
    first_rev = next(iter(revisions.values()))
    return first_rev["prompts"][0]


def test_resolves_new_core_config_using_exact_stem(gallery, train_config, workspace):
    gallery.begin_training(train_config)
    config_file = workspace / "config" / "prefix-2026-07-26_11-17-26.json"
    config_file.parent.mkdir(parents=True, exist_ok=True)
    config_file.write_text("{}", encoding="utf-8")
    batch_id = gallery.begin_batch([sample_definition("prompt_a")], train_config, progress(step=0))
    assert batch_id == 1
    assert (workspace / "web" / "samples" / config_file.stem / "manifest.json").exists()


def test_reuses_canonical_prompt_revision(gallery, train_config, core_config):
    gallery.begin_training(train_config)
    core_config()
    definitions = [sample_definition("prompt_a", unknown_setting="kept")]
    gallery.begin_batch(definitions, train_config, progress(step=0))
    gallery.finish_batch()
    gallery.begin_batch(definitions, train_config, progress(step=100))
    prompts = read_prompts(gallery)
    manifest = read_manifest(gallery)
    assert len(prompts["revisions"]) == 1
    assert manifest["batches"][0]["prompt_revision_id"] == manifest["batches"][1]["prompt_revision_id"]
    assert next(iter(prompts["revisions"].values()))["prompts"][0]["unknown_setting"] == "kept"


def test_repeated_same_step_sampling_creates_distinct_batches(gallery, train_config, core_config):
    gallery.begin_training(train_config)
    core_config()
    first = gallery.begin_batch([sample_definition("prompt_a")], train_config, progress(step=100))
    gallery.finish_batch()
    second = gallery.begin_batch([sample_definition("prompt_a")], train_config, progress(step=100))
    assert (first, second) == (1, 2)


def test_expected_variants_follow_active_ema_config(gallery, train_config, core_config):
    train_config.ema = EMAMode.OFF
    gallery.begin_training(train_config)
    core_config()
    gallery.begin_batch([sample_definition("prompt_a")], train_config, progress(step=0))
    assert read_manifest(gallery)["batches"][0]["expected_variants"] == ["base"]


def test_resolves_custom_prefix(gallery, train_config, workspace):
    train_config.save_filename_prefix = "portrait-"
    gallery.begin_training(train_config)
    write_core_config(workspace, "portrait-2026-07-26_11-17-26.json")
    gallery.begin_batch([sample_definition("prompt_a")], train_config, progress(step=0))
    assert gallery.active_run_key == "portrait-2026-07-26_11-17-26"


def test_disables_missing_or_ambiguous_config_candidate(gallery, train_config, workspace):
    gallery.begin_training(train_config)
    assert gallery.begin_batch([sample_definition("prompt_a")], train_config, progress(step=0)) is None
    gallery.begin_training(train_config)
    write_core_config(workspace, "2026-07-26_11-17-26.json")
    write_core_config(workspace, "2026-07-26_11-17-27.json")
    assert gallery.begin_batch([sample_definition("prompt_a")], train_config, progress(step=0)) is None


def test_rejects_existing_run_key_collision(gallery, train_config, workspace):
    gallery.begin_training(train_config)
    config = write_core_config(workspace, "2026-07-26_11-17-26.json")
    occupied = workspace / "web" / "samples" / config.stem
    occupied.mkdir(parents=True, exist_ok=True)
    write_json_atomic(
        occupied / "manifest.json",
        {"schema_version": 1, "run": {"key": config.stem, "started_at": "different"}, "batches": []},
    )
    assert gallery.begin_batch([sample_definition("prompt_a")], train_config, progress(step=0)) is None


def test_revision_applies_model_defaults_and_train_overlays(gallery, train_config, core_config):
    train_config.text_encoder_layer_skip = 3
    gallery.begin_training(train_config)
    core_config()
    gallery.begin_batch([{"webui_id": "prompt_a", "enabled": True, "prompt": "a"}], train_config, progress(step=0))
    prompt = first_revision_prompt(read_prompts(gallery))
    assert prompt["text_encoder_1_layer_skip"] == 3
    assert prompt["width"] == SampleConfig.default_values(train_config.model_type).width


def test_finish_batch_marks_pending_slots_unavailable(gallery, train_config, core_config):
    gallery.begin_training(train_config)
    core_config()
    gallery.begin_batch([sample_definition("prompt_a")], train_config, progress(step=0))
    gallery.finish_batch()
    assert read_manifest(gallery)["batches"][0]["samples"][0]["status"] == "unavailable"


def test_resolves_changed_same_name_config(gallery, train_config, workspace):
    config = write_core_config(workspace, "2026-07-26_11-17-26.json", content='{"before": true}')
    gallery.begin_training(train_config)
    config.write_text('{"after": true}', encoding="utf-8")
    gallery.begin_batch([sample_definition("prompt_a")], train_config, progress(step=0))
    assert gallery.active_run_key == config.stem
