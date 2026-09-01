import asyncio
from pathlib import Path

from modules.util.config.TrainConfig import TrainConfig
from modules.webui.config_service import ConfigPersistenceError, ConfigService, RevisionConflict
from modules.webui.state import WebUISettings

import pytest


@pytest.fixture
def anyio_backend():
    return "asyncio"


def settings(tmp_path: Path) -> WebUISettings:
    return WebUISettings(
        root_dir=tmp_path,
        config_path=tmp_path / "training_presets" / "#.json",
        secrets_path=tmp_path / "secrets.json",
        presets_dir=tmp_path / "training_presets",
        static_dir=tmp_path / "web" / "build",
    )


@pytest.mark.anyio
async def test_malformed_startup_config_falls_back_with_warning(tmp_path):
    app_settings = settings(tmp_path)
    app_settings.config_path.parent.mkdir(parents=True)
    app_settings.config_path.write_text("not json", encoding="utf-8")
    service = ConfigService.load(app_settings)
    assert service.warnings and "Could not load last-session config" in service.warnings[0]
    assert (await service.snapshot()).config["workspace_dir"] == "workspace/run"


@pytest.mark.anyio
async def test_missing_settings_file_still_loads_secrets(tmp_path):
    app_settings = settings(tmp_path)
    app_settings.secrets_path.write_text('{"huggingface_token": "kept"}', encoding="utf-8")
    service = ConfigService.load(app_settings)
    assert service.warnings == []
    # secrets never appear in snapshots; assert on the canonical config directly
    assert service._config.secrets.huggingface_token == "kept"


@pytest.mark.anyio
async def test_replace_persists_before_swapping_and_increments_revision(tmp_path):
    service = ConfigService.load(settings(tmp_path))
    before = await service.snapshot()
    document = dict(before.config)
    document["workspace_dir"] = "workspace/new"
    after = await service.replace(document, before.revision)
    assert after.config["workspace_dir"] == "workspace/new"
    assert after.revision != before.revision
    reloaded = ConfigService.load(settings(tmp_path))
    assert (await reloaded.snapshot()).config["workspace_dir"] == "workspace/new"


@pytest.mark.anyio
async def test_stale_revision_never_overwrites(tmp_path):
    service = ConfigService.load(settings(tmp_path))
    first = await service.snapshot()
    one = dict(first.config)
    one["workspace_dir"] = "workspace/one"
    await service.replace(one, first.revision)
    stale = dict(first.config)
    stale["workspace_dir"] = "workspace/stale"
    with pytest.raises(RevisionConflict) as conflict:
        await service.replace(stale, first.revision)
    assert conflict.value.current.revision != first.revision
    assert (await service.snapshot()).config["workspace_dir"] == "workspace/one"


@pytest.mark.anyio
async def test_concurrent_writers_accept_exactly_one(tmp_path):
    service = ConfigService.load(settings(tmp_path))
    baseline = await service.snapshot()
    documents = []
    for suffix in ("a", "b"):
        document = dict(baseline.config)
        document["workspace_dir"] = f"workspace/{suffix}"
        documents.append(document)
    results = await asyncio.gather(
        service.replace(documents[0], baseline.revision),
        service.replace(documents[1], baseline.revision),
        return_exceptions=True,
    )
    assert sum(isinstance(result, RevisionConflict) for result in results) == 1


@pytest.mark.anyio
async def test_write_failure_keeps_memory_and_revision(tmp_path, monkeypatch):
    service = ConfigService.load(settings(tmp_path))
    before = await service.snapshot()
    document = dict(before.config)
    document["workspace_dir"] = "workspace/new"
    monkeypatch.setattr("modules.webui.config_service.save_settings", lambda config, path: (_ for _ in ()).throw(OSError("disk full")))
    with pytest.raises(ConfigPersistenceError):
        await service.replace(document, before.revision)
    assert await service.snapshot() == before


@pytest.mark.anyio
async def test_change_listeners_and_current_workspace(tmp_path):
    service = ConfigService.load(settings(tmp_path))
    assert service.current_workspace == "workspace/run"

    notifications = []

    async def listener(snapshot):
        notifications.append(snapshot)

    async def failing_listener(snapshot):
        raise RuntimeError("listener failure")

    service.add_change_listener(listener)
    service.add_change_listener(failing_listener)

    before = await service.snapshot()
    document = dict(before.config)
    document["workspace_dir"] = "workspace/updated"

    after = await service.replace(document, before.revision)
    assert len(notifications) == 1
    assert notifications[0] == after
    assert service.current_workspace == "workspace/updated"

    service.remove_change_listener(listener)
    document_two = dict(after.config)
    document_two["workspace_dir"] = "workspace/updated2"
    await service.replace(document_two, after.revision)
    assert len(notifications) == 1


@pytest.mark.anyio
async def test_replace_config_and_overwrite(tmp_path):
    service = ConfigService.load(settings(tmp_path))
    before = await service.snapshot()

    new_config = TrainConfig.default_values()
    new_config.workspace_dir = "workspace/from_config"

    after = await service.replace_config(new_config, before.revision, overwrite=True)
    assert after.config["workspace_dir"] == "workspace/from_config"

    document = dict(after.config)
    document["workspace_dir"] = "workspace/overwrite_doc"
    overwritten = await service.overwrite(document, after.revision)
    assert overwritten.config["workspace_dir"] == "workspace/overwrite_doc"
