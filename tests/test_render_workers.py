"""video.parallel_renders: a number, or "auto" sized to the machine."""

import types

import pytest

pipeline = pytest.importorskip("core.pipeline")


def _machine(monkeypatch, cores, ram_gb):
    monkeypatch.setattr(pipeline.os, "cpu_count", lambda: cores)
    fake = types.SimpleNamespace(virtual_memory=lambda: types.SimpleNamespace(total=ram_gb * 2**30))
    monkeypatch.setitem(__import__("sys").modules, "psutil", fake)


@pytest.mark.parametrize(("cores", "ram", "want"), [
    (6, 16, 3),     # what the old fixed 3 was tuned for
    (18, 64, 6),    # an M5 Pro with 64 GB
    (12, 32, 4),
    (4, 8, 3),      # never below 3
    (64, 512, 8),   # never above 8
    (32, 16, 3),    # memory limits it too
])
def test_auto_sizes_to_cores_and_memory(monkeypatch, cores, ram, want):
    _machine(monkeypatch, cores, ram)
    assert pipeline.render_workers({"video": {"parallel_renders": "auto"}}) == want


def test_a_number_is_used_as_given_and_auto_is_the_default(monkeypatch):
    _machine(monkeypatch, 18, 64)
    assert pipeline.render_workers({"video": {"parallel_renders": 2}}) == 2
    assert pipeline.render_workers({"video": {"parallel_renders": 0}}) == 1
    assert pipeline.render_workers({}) == 6
