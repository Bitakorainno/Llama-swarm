import json
import os
import sys
import time
from pathlib import Path
import pytest

# Asegurar import de tools/orchestrator_mcp.py
tools_dir = Path(__file__).resolve().parent.parent
if str(tools_dir) not in sys.path:
    sys.path.insert(0, str(tools_dir))

import orchestrator_mcp as orch


def test_normalize_role():
    assert orch.normalize_role("planificador") == "planner"
    assert orch.normalize_role("PLANIFICADOR ") == "planner"
    assert orch.normalize_role("desarrollador") == "developer"
    assert orch.normalize_role("analista") == "analyst"
    assert orch.normalize_role("frontend") == "frontend"
    assert orch.normalize_role("unknown") == "unknown"


def test_load_modes():
    modes = orch.load_modes()
    assert "planificador" in modes
    assert "desarrollador" in modes
    assert "orquestador" in modes
    assert len(modes["planificador"]) > 0


def test_run_agent_invalid_role():
    with pytest.raises(ValueError, match="rol desconocido"):
        orch.run_agent("rol_invalido", "tarea")


def test_run_agent_invalid_workspace(tmp_path):
    missing_dir = tmp_path / "no_existe_directorio"
    with pytest.raises(ValueError, match="workspace no existe"):
        orch.run_agent("planner", "tarea", workspace=str(missing_dir))


def test_run_agents_validation():
    with pytest.raises(ValueError, match="lista no vacia"):
        orch.run_agents([])

    with pytest.raises(ValueError, match="lista no vacia"):
        orch.run_agents("no_es_lista")

    with pytest.raises(ValueError, match="cada agente debe ser un objeto"):
        orch.run_agents(["no_es_dict"])

    with pytest.raises(ValueError, match="maximo"):
        orch.run_agents([{"role": "planner", "task": "t"}] * (orch.MAX_DELEGATIONS + 1))


def test_run_agents_parallel_preserves_order_and_catches_errors(monkeypatch):
    def fake_run_agent(role, task, model=None, workspace=None, max_steps=None, **kwargs):
        if role == "developer":
            raise RuntimeError("falla simulada")
        return {"role": role, "content": f"resultado {task}", "tools_used": []}

    monkeypatch.setattr(orch, "run_agent", fake_run_agent)

    batch = [
        {"role": "planner", "task": "plan"},
        {"role": "developer", "task": "dev"},
        {"role": "tester", "task": "test"},
    ]

    out = orch.run_agents(batch)
    assert out["count"] == 3
    assert [r["index"] for r in out["results"]] == [0, 1, 2]
    assert out["results"][0]["content"] == "resultado plan"
    assert "ERROR: falla simulada" in out["results"][1]["content"]
    assert out["results"][2]["content"] == "resultado test"


def test_validate_batch_rejects_duplicates_unknown_self_and_cycles():
    with pytest.raises(ValueError, match="duplicada"):
        orch.validate_batch([
            {"role": "planner", "task": "t", "key": "a"},
            {"role": "tester", "task": "t", "key": "a"},
        ])

    with pytest.raises(ValueError, match="desconocida"):
        orch.validate_batch([
            {"role": "planner", "task": "t", "key": "a", "depends_on": ["zzz"]},
        ])

    with pytest.raises(ValueError, match="si mismo"):
        orch.validate_batch([
            {"role": "planner", "task": "t", "key": "a", "depends_on": ["a"]},
        ])

    with pytest.raises(ValueError, match="[Cc]icl"):
        orch.validate_batch([
            {"role": "planner", "task": "t", "key": "a", "depends_on": ["b"]},
            {"role": "tester", "task": "t", "key": "b", "depends_on": ["a"]},
        ])

    with pytest.raises(ValueError, match="key invalida"):
        orch.validate_batch([
            {"role": "planner", "task": "t", "key": "no spaces"},
        ])


def test_resolve_timeout_bounds():
    assert orch.resolve_timeout(None) == orch.DEFAULT_AGENT_TIMEOUT
    assert orch.resolve_timeout(0) == 1
    assert orch.resolve_timeout(10 ** 9) == orch.MAX_AGENT_TIMEOUT
    assert orch.resolve_timeout("42") == 42
    assert orch.resolve_timeout("nan") == orch.DEFAULT_AGENT_TIMEOUT


def test_run_agents_dag_runs_dependency_first(monkeypatch):
    calls = []

    def fake_run_agent(role, task, model=None, workspace=None, max_steps=None, **kwargs):
        calls.append(task)
        return {"role": role, "content": f"done {task}", "tools_used": []}

    monkeypatch.setattr(orch, "run_agent", fake_run_agent)

    batch = [
        {"role": "frontend", "task": "ui", "key": "ui", "depends_on": ["api"]},
        {"role": "backend", "task": "api", "key": "api"},
    ]

    out = orch.run_agents(batch)
    assert calls == ["api", "ui"]
    by_key = {r["key"]: r for r in out["results"]}
    assert by_key["api"]["status"] == "ok"
    assert by_key["ui"]["status"] == "ok"
    assert by_key["ui"]["index"] == 0


def test_run_agents_dag_skips_dependents_when_dependency_fails(monkeypatch):
    def fake_run_agent(role, task, model=None, workspace=None, max_steps=None, **kwargs):
        if role == "backend":
            raise RuntimeError("boom")
        return {"role": role, "content": "done", "tools_used": []}

    monkeypatch.setattr(orch, "run_agent", fake_run_agent)

    batch = [
        {"role": "frontend", "task": "ui", "key": "ui", "depends_on": ["api"]},
        {"role": "backend", "task": "api", "key": "api"},
    ]

    out = orch.run_agents(batch)
    by_key = {r["key"]: r for r in out["results"]}
    assert by_key["api"]["status"] == "error"
    assert by_key["ui"]["status"] == "skipped"
    assert "omitido" in by_key["ui"]["content"]


def test_run_agents_timeout_marks_agent_and_skips_dependents(monkeypatch):
    def slow_run_agent(role, task, model=None, workspace=None, max_steps=None, **kwargs):
        time.sleep(5)
        return {"role": role, "content": "late", "tools_used": []}

    monkeypatch.setattr(orch, "run_agent", slow_run_agent)

    batch = [
        {"role": "backend", "task": "slow", "key": "slow", "timeout": 1},
        {"role": "frontend", "task": "ui", "key": "ui", "depends_on": ["slow"]},
    ]

    started = time.monotonic()
    out = orch.run_agents(batch)
    elapsed = time.monotonic() - started

    assert elapsed < 5
    by_key = {r["key"]: r for r in out["results"]}
    assert by_key["slow"]["status"] == "timeout"
    assert by_key["ui"]["status"] == "skipped"


def test_spawn_agents_emits_progress_and_message_notifications(monkeypatch, capsys):
    def fake_run_agent(role, task, model=None, workspace=None, max_steps=None, on_event=None, **kwargs):
        if on_event:
            on_event("tool_call", {"role": role, "tool": "read_file", "arguments": {"path": "x"}})
        return {"role": role, "content": "done", "tools_used": []}

    monkeypatch.setattr(orch, "run_agent", fake_run_agent)

    orch.execute_tool(
        "spawn_agents",
        {"agents": [{"role": "planner", "task": "analiza"}]},
        progress_token="tok-1",
    )

    frames = [json.loads(line) for line in capsys.readouterr().out.splitlines() if line.strip()]
    progress = [f for f in frames if f.get("method") == "notifications/progress"]
    assert progress, "se esperaban notifications/progress"
    assert all(f["params"]["progressToken"] == "tok-1" for f in progress)
    assert any(f["params"].get("progress") == 1 for f in progress)

    messages = [f for f in frames if f.get("method") == "notifications/message"]
    assert any("read_file" in str(f["params"].get("data")) for f in messages)
