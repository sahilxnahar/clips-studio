"""A web page can't change anything through the local API.

A page can send a body-less POST to 127.0.0.1 without asking first, and CORS
only stops it reading the answer. Before this guard, a page the person visited
could publish their "ask first" clips (POST /automation/items/{id}/publish) or
resume the queue. Browsers put an Origin header on every POST; scripts,
plugins, the SDK and the MCP server send none and are unaffected.
"""

import shutil
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
EVIL = {"Origin": "https://evil.example", "Content-Type": "text/plain"}


@pytest.fixture
def engine(tmp_path, monkeypatch):
    pytest.importorskip("fastapi")
    pytest.importorskip("httpx")
    pytest.importorskip("yaml")
    pytest.importorskip("numpy")
    pytest.importorskip("yt_dlp")
    from fastapi.testclient import TestClient

    from main import BUNDLED_CONFIG, load_config
    from plugins import session
    from server.api import create_app

    monkeypatch.delenv(session.ENV, raising=False)
    settings = tmp_path / "settings.yaml"
    shutil.copy(ROOT / "config" / "settings.yaml", settings)
    config = load_config(BUNDLED_CONFIG)
    config["paths"]["data_dir"] = str(tmp_path / "data")
    client = TestClient(create_app(config, settings), base_url="http://127.0.0.1")
    secret = session.path(tmp_path / "data").read_text(encoding="utf-8").strip()
    return client, {session.HEADER: secret}


@pytest.mark.parametrize("path", [
    "/automation/items/987654/publish",
    "/automation/items/987654/queue",
    "/automation/items/987654/skip",
    "/queue/resume",
    "/queue/pause",
    "/jobs/987654/retry",
])
def test_a_web_page_cannot_change_anything(engine, path):
    client, _header = engine
    got = client.post(path, headers=EVIL)
    assert got.status_code == 403
    assert "X-Clips-Kitty-Session" in got.json()["detail"]


def test_a_sandboxed_frame_claiming_the_null_origin_is_refused_too(engine):
    client, _header = engine
    assert client.post("/queue/resume", headers={"Origin": "null"}).status_code == 403


def test_a_wrong_header_does_not_help_a_page(engine):
    client, _header = engine
    got = client.post("/queue/resume", headers={**EVIL, "X-Clips-Kitty-Session": "not-the-secret-0123456789"})
    assert got.status_code == 403


def test_the_desktop_window_with_the_header_reaches_the_route(engine):
    client, header = engine
    got = client.post("/automation/items/987654/publish", headers={"Origin": "null", **header})
    assert got.status_code == 404 and got.json()["detail"] == "no such video"


def test_the_dev_server_still_works(engine):
    client, _header = engine
    assert client.post("/queue/pause", headers={"Origin": "http://localhost:5173"}).status_code == 200


def test_scripts_and_plugins_without_an_origin_are_unaffected(engine):
    client, _header = engine
    got = client.post("/automation/items/987654/publish")
    assert got.status_code == 404 and got.json()["detail"] == "no such video"


def test_reading_from_a_page_is_unaffected(engine):
    client, _header = engine
    assert client.get("/health", headers={"Origin": "https://evil.example"}).status_code == 200
