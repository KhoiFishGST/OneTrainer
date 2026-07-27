import json
import sys
from pathlib import Path
from unittest.mock import Mock

sys.modules.setdefault("av", Mock())

from modules.modelSampler.BaseModelSampler import ModelSamplerOutput
from modules.util.config.SampleConfig import SampleConfig
from modules.util.config.TrainConfig import TrainConfig
from modules.webui.gallery import GalleryService, TrainingProgressSnapshot
from modules.webui.sampling_coordinator import (
    PromptDefinitionsError,
    PromptPersistenceError,
    SamplingCoordinator,
)

import pytest


def progress(step: int = 0, epoch: int = 1, epoch_step: int = 0) -> TrainingProgressSnapshot:
    return TrainingProgressSnapshot(epoch=epoch, epoch_step=epoch_step, global_step=step)


@pytest.fixture
def prompt_file(tmp_path: Path) -> Path:
    p = tmp_path / "training_samples" / "samples.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps([{"webui_id": "prompt_a", "prompt": "old"}]), encoding="utf-8")
    return p


@pytest.fixture
def train_config() -> TrainConfig:
    return TrainConfig.default_values()


@pytest.fixture
def gallery() -> Mock:
    mock = Mock(spec=GalleryService)
    mock.record_default_sample.return_value = None
    return mock


@pytest.fixture
def image_output() -> Mock:
    return Mock(spec=ModelSamplerOutput)


@pytest.fixture
def coordinator(tmp_path: Path, prompt_file: Path, gallery: Mock) -> SamplingCoordinator:
    return SamplingCoordinator(
        root_dir=tmp_path,
        sample_path_provider=lambda: prompt_file,
        gallery=gallery,
    )


def test_get_backfills_missing_ids_and_replaces_duplicates(
    coordinator: SamplingCoordinator, prompt_file: Path
) -> None:
    prompt_file.write_text(
        json.dumps([{"prompt": "a"}, {"prompt": "b", "webui_id": "same"}, {"prompt": "c", "webui_id": "same"}]),
        encoding="utf-8",
    )
    state = coordinator.get_definitions()
    ids = [sample["webui_id"] for sample in state.samples]
    assert all(value.startswith("prompt_") for value in ids)
    assert len(set(ids)) == 3
    assert state.queued is False


def test_edit_during_sampling_is_durable_and_applies_after_batch(
    coordinator: SamplingCoordinator, gallery: Mock, prompt_file: Path, train_config: TrainConfig
) -> None:
    coordinator.begin_training(train_config)
    coordinator.on_status("Sampling ...", progress(step=100))
    queued = coordinator.put_definitions([{"webui_id": "prompt_a", "prompt": "new"}])
    assert queued.queued is True
    assert json.loads(prompt_file.read_text(encoding="utf-8"))[0]["prompt"] == "old"
    assert Path(f"{prompt_file}.webui-pending").exists()
    coordinator.on_status("Training ...", progress(step=100))
    assert json.loads(prompt_file.read_text(encoding="utf-8"))[0]["prompt"] == "new"
    assert not Path(f"{prompt_file}.webui-pending").exists()
    gallery.finish_batch.assert_called_once()


def test_restart_recovers_pending_update(coordinator: SamplingCoordinator, prompt_file: Path) -> None:
    pending = Path(f"{prompt_file}.webui-pending")
    pending.write_text(json.dumps([{"webui_id": "prompt_a", "prompt": "recovered"}]), encoding="utf-8")
    coordinator.recover_pending()
    assert json.loads(prompt_file.read_text(encoding="utf-8"))[0]["prompt"] == "recovered"
    assert not pending.exists()


def test_edit_before_sampling_is_used_by_next_batch(
    coordinator: SamplingCoordinator, gallery: Mock, train_config: TrainConfig
) -> None:
    state = coordinator.put_definitions([{"webui_id": "prompt_a", "prompt": "new"}])
    coordinator.begin_training(train_config)
    coordinator.on_status("Sampling ...", progress(step=0))
    assert state.queued is False
    assert gallery.begin_batch.call_args.args[0][0]["prompt"] == "new"


def test_put_preserves_ids_and_latest_queued_edit_wins(
    coordinator: SamplingCoordinator, prompt_file: Path, train_config: TrainConfig
) -> None:
    coordinator.begin_training(train_config)
    coordinator.on_status("Sampling ...", progress(step=0))
    coordinator.put_definitions([{"webui_id": "prompt_a", "prompt": "first"}])
    coordinator.put_definitions([{"webui_id": "prompt_a", "prompt": "latest"}])
    coordinator.on_status("Training ...", progress(step=0))
    applied = json.loads(prompt_file.read_text(encoding="utf-8"))
    assert applied == [{"webui_id": "prompt_a", "prompt": "latest"}]


def test_failed_pending_write_is_not_acknowledged(
    coordinator: SamplingCoordinator, train_config: TrainConfig, monkeypatch: pytest.MonkeyPatch
) -> None:
    coordinator.begin_training(train_config)
    coordinator.on_status("Sampling ...", progress(step=0))
    monkeypatch.setattr(
        "modules.webui.sampling_coordinator.write_json_atomic",
        Mock(side_effect=OSError("disk full")),
    )
    with pytest.raises(PromptPersistenceError, match="disk full"):
        coordinator.put_definitions([{"prompt": "new"}])


def test_repeated_sampling_status_opens_one_batch_and_finish_closes_it(
    coordinator: SamplingCoordinator, gallery: Mock, train_config: TrainConfig
) -> None:
    coordinator.begin_training(train_config)
    coordinator.on_status("Sampling ...", progress(step=0))
    coordinator.on_status("Sampling ...", progress(step=0))
    coordinator.finish_training()
    gallery.begin_batch.assert_called_once()
    gallery.finish_batch.assert_called_once()
    gallery.finish_training.assert_called_once()


def test_inline_samples_queue_for_next_training_run(
    coordinator: SamplingCoordinator, gallery: Mock, train_config: TrainConfig
) -> None:
    train_config.samples = [SampleConfig.default_values(train_config.model_type)]
    coordinator.begin_training(train_config)
    coordinator.on_status("Sampling ...", progress(step=0))
    state = coordinator.put_definitions([{"webui_id": "prompt_new", "prompt": "next run"}])
    assert state.queued is True
    assert gallery.begin_batch.call_args.args[0][0]["prompt"] == train_config.samples[0].prompt


def test_on_default_sample_delegates_to_gallery(coordinator: SamplingCoordinator, gallery: Mock, image_output: Mock) -> None:
    gallery.record_default_sample.return_value = {"run_key": "run", "status": "ready"}
    assert coordinator.on_default_sample(image_output) == {"run_key": "run", "status": "ready"}


def test_put_definitions_validates_object_structure(coordinator: SamplingCoordinator) -> None:
    with pytest.raises(PromptDefinitionsError, match="Each sample definition must be an object"):
        coordinator.put_definitions(["not a dict"])  # type: ignore[arg-type]


def test_gallery_errors_are_suppressed(
    coordinator: SamplingCoordinator, gallery: Mock, train_config: TrainConfig, image_output: Mock
) -> None:
    gallery.begin_training.side_effect = RuntimeError("gallery fail")
    gallery.begin_batch.side_effect = RuntimeError("gallery fail")
    gallery.finish_batch.side_effect = RuntimeError("gallery fail")
    gallery.finish_training.side_effect = RuntimeError("gallery fail")
    gallery.record_default_sample.side_effect = RuntimeError("gallery fail")

    coordinator.begin_training(train_config)
    coordinator.on_status("Sampling ...", progress(step=0))
    coordinator.on_status("Training ...", progress(step=0))
    assert coordinator.on_default_sample(image_output) is None
    coordinator.finish_training()


def test_recover_pending_on_finish_training_when_batch_not_open(
    coordinator: SamplingCoordinator, prompt_file: Path, train_config: TrainConfig
) -> None:
    train_config.samples = [SampleConfig.default_values(train_config.model_type)]
    coordinator.begin_training(train_config)
    coordinator.on_status("Sampling ...", progress(step=0))
    coordinator.on_status("Training ...", progress(step=0))
    # batch is now closed (batch_open is False)
    coordinator.put_definitions([{"webui_id": "prompt_a", "prompt": "edited_while_training"}])
    assert Path(f"{prompt_file}.webui-pending").exists()

    coordinator.finish_training()
    assert not Path(f"{prompt_file}.webui-pending").exists()
    assert json.loads(prompt_file.read_text(encoding="utf-8"))[0]["prompt"] == "edited_while_training"



def test_get_definitions_falls_back_to_inline_config_samples_when_file_missing(
    tmp_path: Path, gallery: Mock, train_config: TrainConfig
) -> None:
    missing_file = tmp_path / "non_existent" / "samples.json"
    coord = SamplingCoordinator(
        root_dir=tmp_path,
        sample_path_provider=lambda: missing_file,
        gallery=gallery,
    )
    train_config.samples = [SampleConfig.default_values(train_config.model_type)]
    coord.begin_training(train_config)

    state = coord.get_definitions()
    assert len(state.samples) == 1
    assert state.samples[0]["prompt"] == train_config.samples[0].prompt


def test_file_override_resolves_to_training_samples_dir(coordinator: SamplingCoordinator, tmp_path: Path) -> None:
    coordinator.put_definitions([{"prompt": "override prompt"}], file="custom_file")
    expected_file = tmp_path / "training_samples" / "custom_file.json"
    assert expected_file.exists()

    state = coordinator.get_definitions(file="custom_file")
    assert len(state.samples) == 1
    assert state.samples[0]["prompt"] == "override prompt"


