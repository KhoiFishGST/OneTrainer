from modules.webui.app import IMMUTABLE_CACHE_CONTROL, create_app
from modules.webui.state import WebUISettings

from fastapi.testclient import TestClient


def _make_client(tmp_path):
    static_dir = tmp_path / "static"
    (static_dir / "_app" / "immutable" / "chunks").mkdir(parents=True)
    (static_dir / "index.html").write_text("<html>index</html>" * 200, encoding="utf-8")
    (static_dir / "_app" / "immutable" / "chunks" / "big.js").write_text("x=1;" * 5000, encoding="utf-8")
    (static_dir / "logo.png").write_bytes(b"\x89PNG\r\n\x1a\n" + bytes(range(256)) * 40)

    settings = WebUISettings(
        root_dir=tmp_path,
        config_path=tmp_path / "config.json",
        secrets_path=tmp_path / "secrets.json",
        presets_dir=tmp_path / "presets",
        static_dir=static_dir,
        dev=False,
    )
    return TestClient(create_app(settings))


def test_javascript_assets_are_gzipped(tmp_path):
    with _make_client(tmp_path) as client:
        res = client.get("/_app/immutable/chunks/big.js", headers={"accept-encoding": "gzip"})
        assert res.status_code == 200
        assert res.headers["content-encoding"] == "gzip"
        assert res.headers["vary"] == "Accept-Encoding"


def test_images_are_not_gzipped(tmp_path):
    with _make_client(tmp_path) as client:
        res = client.get("/logo.png", headers={"accept-encoding": "gzip"})
        assert res.status_code == 200
        assert "content-encoding" not in res.headers


def test_clients_without_gzip_support_still_get_the_asset(tmp_path):
    with _make_client(tmp_path) as client:
        res = client.get("/_app/immutable/chunks/big.js", headers={"accept-encoding": "identity"})
        assert res.status_code == 200
        assert "content-encoding" not in res.headers
        assert res.text.startswith("x=1;")


def test_hashed_assets_are_cached_immutably(tmp_path):
    with _make_client(tmp_path) as client:
        res = client.get("/_app/immutable/chunks/big.js")
        assert res.headers["cache-control"] == IMMUTABLE_CACHE_CONTROL
        assert IMMUTABLE_CACHE_CONTROL == "public, max-age=31536000, immutable"


def test_index_html_is_never_cached_immutably(tmp_path):
    with _make_client(tmp_path) as client:
        for path in ("/", "/general"):
            res = client.get(path)
            assert res.status_code == 200
            assert res.headers.get("cache-control") != IMMUTABLE_CACHE_CONTROL
