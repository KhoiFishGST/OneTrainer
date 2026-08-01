import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, Mock

sys.modules.setdefault("av", MagicMock())

from modules.modelSampler.BaseModelSampler import ModelSamplerOutput
from modules.util.config.SampleConfig import SampleConfig
from modules.util.config.TrainConfig import TrainConfig
from modules.util.enum.EMAMode import EMAMode
from modules.util.enum.FileType import FileType
from modules.webui.atomic_io import write_json_atomic
from modules.webui.gallery import (
    GalleryNotFound,
    GalleryService,
    TrainingProgressSnapshot,
)

import torch

import pytest
from PIL import Image


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


def ready_samples(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        s
        for b in manifest.get("batches", [])
        for s in b.get("samples", [])
        if s.get("status") == "ready"
    ]


def image_output(source_path: Path) -> ModelSamplerOutput:
    output = ModelSamplerOutput(FileType.IMAGE, Image.open(source_path))
    output.filepath = str(source_path)
    return output


@pytest.fixture
def active_gallery(gallery: GalleryService, train_config: TrainConfig, core_config: Any) -> GalleryService:
    train_config.ema = EMAMode.GPU
    train_config.non_ema_sampling = True
    gallery.begin_training(train_config)
    core_config()
    definitions = [
        sample_definition("prompt_a", prompt="a portrait of a cat"),
    ]
    gallery.begin_batch(definitions, train_config, progress(step=0))
    return gallery


@pytest.fixture
def source_png(workspace: Path) -> Path:
    sample_dir = workspace / "samples" / "0 - a portrait of a cat"
    sample_dir.mkdir(parents=True, exist_ok=True)
    file_path = sample_dir / "sample-000000.png"
    img = Image.new("RGB", (100, 100), color="blue")
    img.save(file_path, format="PNG")
    return file_path


@pytest.fixture
def non_ema_source(workspace: Path) -> Path:
    sample_dir = workspace / "samples" / "0 - a portrait of a cat - no-ema"
    sample_dir.mkdir(parents=True, exist_ok=True)
    file_path = sample_dir / "sample-000000-no-ema.png"
    img = Image.new("RGB", (100, 100), color="red")
    img.save(file_path, format="PNG")
    return file_path


@pytest.fixture
def output_for_kind(workspace: Path, tmp_path: Path, source_png: Path) -> Any:
    def _create(kind: str) -> ModelSamplerOutput:
        if kind == "outside_workspace":
            outside_file = tmp_path / "outside.png"
            img = Image.new("RGB", (50, 50), "green")
            img.save(outside_file)
            out = ModelSamplerOutput(FileType.IMAGE, img)
            out.filepath = str(outside_file)
            return out
        elif kind == "wrong_parent":
            wrong_dir = workspace / "samples" / "wrong_parent_dir"
            wrong_dir.mkdir(parents=True, exist_ok=True)
            wrong_file = wrong_dir / "sample.png"
            img = Image.new("RGB", (50, 50), "yellow")
            img.save(wrong_file)
            out = ModelSamplerOutput(FileType.IMAGE, img)
            out.filepath = str(wrong_file)
            return out
        elif kind == "non_image":
            out = ModelSamplerOutput(FileType.VIDEO, torch.zeros((10, 10, 10, 3)))
            out.filepath = str(source_png)
            return out
        raise ValueError(f"Unknown kind: {kind}")

    return _create


@pytest.fixture
def outputs_for_all_slots(source_png: Path, non_ema_source: Path) -> list[ModelSamplerOutput]:
    return [image_output(source_png), image_output(non_ema_source)]


@pytest.fixture
def historical_run_factory(workspace: Path) -> Any:
    def _create(run_key: str, started_at: str | None, raw_manifest: str | None = None) -> Path:
        run_dir = workspace / "web" / "samples" / run_key
        run_dir.mkdir(parents=True, exist_ok=True)
        manifest_path = run_dir / "manifest.json"
        if raw_manifest is not None:
            manifest_path.write_text(raw_manifest, encoding="utf-8")
        else:
            manifest_doc = {
                "schema_version": 1,
                "run": {
                    "key": run_key,
                    "config_filename": f"{run_key}.json",
                    "started_at": started_at,
                },
                "batches": [],
            }
            write_json_atomic(manifest_path, manifest_doc)
        return run_dir

    return _create


def test_record_sample_copies_exact_bytes_and_creates_thumbnail(active_gallery, source_png):
    output = ModelSamplerOutput(FileType.IMAGE, Image.open(source_png))
    output.filepath = str(source_png)
    event = active_gallery.record_default_sample(output)
    manifest = read_manifest(active_gallery)
    sample = manifest["batches"][0]["samples"][0]
    mirrored = active_gallery.active_run_dir / sample["filename"]
    thumbnail = active_gallery.active_run_dir / sample["thumbnail_filename"]
    assert mirrored.read_bytes() == source_png.read_bytes()
    with Image.open(thumbnail) as image:
        assert image.width <= 512
        assert image.height <= 512
        assert image.format == "WEBP"
    assert event["run_key"] == active_gallery.active_run_key
    assert event["batch_id"] == 1


def test_non_ema_parent_maps_to_non_ema_without_prompt_suffix_confusion(active_gallery, non_ema_source):
    output = image_output(non_ema_source)
    active_gallery.record_default_sample(output)
    ready = ready_samples(read_manifest(active_gallery))
    assert ready[0]["variant"] == "non_ema"


def test_get_image_rejects_unreferenced_and_escaping_files(active_gallery, source_png):
    active_gallery.record_default_sample(image_output(source_png))
    with pytest.raises(GalleryNotFound):
        active_gallery.get_image(active_gallery.active_run_key, "../manifest.json")
    rogue = active_gallery.active_run_dir / "rogue.png"
    rogue.write_bytes(b"rogue")
    with pytest.raises(GalleryNotFound):
        active_gallery.get_image(active_gallery.active_run_key, rogue.name)


def test_thumbnail_failure_keeps_full_image_ready(active_gallery, source_png, monkeypatch):
    monkeypatch.setattr("modules.webui.gallery.save_pil_atomic", Mock(side_effect=OSError("thumbnail failed")))
    active_gallery.record_default_sample(image_output(source_png))
    sample = ready_samples(read_manifest(active_gallery))[0]
    assert sample["status"] == "ready"
    assert sample["thumbnail_filename"] == sample["filename"]
    assert sample["thumbnail_error"] == "thumbnail failed"


def test_copy_failure_marks_slot_error_without_touching_core(active_gallery, source_png, monkeypatch):
    original = source_png.read_bytes()
    monkeypatch.setattr("modules.webui.gallery.copy_file_atomic", Mock(side_effect=OSError("copy failed")))
    assert active_gallery.record_default_sample(image_output(source_png)) is None
    assert source_png.read_bytes() == original
    assert read_manifest(active_gallery)["batches"][0]["samples"][0]["status"] == "error"


@pytest.mark.parametrize("source_kind", ["outside_workspace", "wrong_parent", "non_image"])
def test_rejects_unassociable_or_unsupported_output(active_gallery, output_for_kind, source_kind):
    assert active_gallery.record_default_sample(output_for_kind(source_kind)) is None
    assert ready_samples(read_manifest(active_gallery)) == []


def test_concurrent_callbacks_do_not_corrupt_manifest(active_gallery, outputs_for_all_slots):
    with ThreadPoolExecutor(max_workers=len(outputs_for_all_slots)) as executor:
        list(executor.map(active_gallery.record_default_sample, outputs_for_all_slots))
    manifest = read_manifest(active_gallery)
    assert len(ready_samples(manifest)) == len(outputs_for_all_slots)
    json.loads((active_gallery.active_run_dir / "manifest.json").read_text(encoding="utf-8"))


def test_list_runs_is_newest_first_and_isolates_corrupt_runs(gallery, historical_run_factory):
    historical_run_factory("older", "2026-07-26T10:00:00Z")
    historical_run_factory("newer", "2026-07-26T11:00:00Z")
    historical_run_factory("corrupt", None, raw_manifest="not json")
    assert [run["key"] for run in gallery.list_runs()] == ["newer", "older"]


def test_current_gallery_shapes_before_and_after_first_batch(gallery, train_config, core_config):
    assert gallery.get_current_model() == {"active": False, "run": None, "batches": [], "revisions": {}}
    gallery.begin_training(train_config)
    assert gallery.get_current_model() == {"active": True, "run": None, "batches": [], "revisions": {}}
    core_config()
    gallery.begin_batch([sample_definition("prompt_a")], train_config, progress(step=0))
    assert gallery.get_current_model()["run"]["key"] == gallery.active_run_key


def test_missing_referenced_image_becomes_unavailable(active_gallery, source_png):
    active_gallery.record_default_sample(image_output(source_png))
    image = active_gallery.get_image(active_gallery.active_run_key, ready_samples(read_manifest(active_gallery))[0]["filename"])
    image.path.unlink()
    with pytest.raises(GalleryNotFound):
        active_gallery.get_image(active_gallery.active_run_key, image.path.name)
    assert active_gallery.get_run_model(active_gallery.active_run_key)["batches"][0]["samples"][0]["status"] == "unavailable"


def test_get_run_model_rejects_invalid_run_key(gallery):
    with pytest.raises(GalleryNotFound):
        gallery.get_run_model("../outside")
    with pytest.raises(GalleryNotFound):
        gallery.get_run_model("foo/bar")
    with pytest.raises(GalleryNotFound):
        gallery.get_run_model("foo\\bar")


def test_record_sample_converts_image_mode_for_webp_thumbnail(active_gallery, workspace):
    sample_dir = workspace / "samples" / "0 - a portrait of a cat"
    sample_dir.mkdir(parents=True, exist_ok=True)
    file_path = sample_dir / "sample-la.png"
    img = Image.new("LA", (100, 100), color=(128, 255))
    img.save(file_path, format="PNG")

    output = ModelSamplerOutput(FileType.IMAGE, img)
    output.filepath = str(file_path)
    event = active_gallery.record_default_sample(output)
    assert event is not None
    manifest = read_manifest(active_gallery)
    sample = manifest["batches"][0]["samples"][0]
    thumbnail = active_gallery.active_run_dir / sample["thumbnail_filename"]
    assert thumbnail.exists()


def write_run_manifest(workspace: Path, run_key: str, run: dict[str, Any]) -> Path:
    run_dir = workspace / "web" / "samples" / run_key
    run_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = run_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps({"schema_version": 1, "run": run, "batches": []}),
        encoding="utf-8",
    )
    return manifest_path


def test_get_run_config_path_resolves_manifest_filename(gallery: GalleryService, workspace: Path):
    write_run_manifest(workspace, "run1", {"key": "run1", "config_filename": "run1.json"})

    assert gallery.get_run_config_path("run1") == workspace / "config" / "run1.json"


def test_get_run_config_path_rejects_unknown_run(gallery: GalleryService, workspace: Path):
    with pytest.raises(GalleryNotFound, match="Run not found"):
        gallery.get_run_config_path("nope")


@pytest.mark.parametrize("run_key", ["../outside", "a/b", "a\\b", ".."])
def test_get_run_config_path_rejects_unsafe_run_key(gallery: GalleryService, run_key: str):
    with pytest.raises(GalleryNotFound, match="Run not found"):
        gallery.get_run_config_path(run_key)


@pytest.mark.parametrize("run", [{"key": "run1"}, {"key": "run1", "config_filename": ""}])
def test_get_run_config_path_requires_recorded_filename(
    gallery: GalleryService, workspace: Path, run: dict[str, Any]
):
    write_run_manifest(workspace, "run1", run)

    with pytest.raises(GalleryNotFound, match="Run has no recorded config file"):
        gallery.get_run_config_path("run1")


def test_get_run_config_path_rejects_unreadable_manifest(gallery: GalleryService, workspace: Path):
    run_dir = workspace / "web" / "samples" / "run1"
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "manifest.json").write_text("{not json", encoding="utf-8")

    with pytest.raises(GalleryNotFound, match="Run not found"):
        gallery.get_run_config_path("run1")


def test_get_run_config_path_confines_poisoned_filename_to_config_dir(
    gallery: GalleryService, workspace: Path
):
    write_run_manifest(
        workspace, "run1", {"key": "run1", "config_filename": "../../evil.json"}
    )

    assert gallery.get_run_config_path("run1") == workspace / "config" / "evil.json"

