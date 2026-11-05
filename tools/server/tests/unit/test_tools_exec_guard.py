import os

import pytest

from utils import *

server: ServerProcess


@pytest.fixture(autouse=True)
def create_server():
    global server
    server = ServerPreset.router()
    server.server_tools = "all"


def call_tool(name: str, params: dict, headers: dict | None = None) -> dict:
    res = server.make_request("POST", "/tools", data={"tool": name, "params": params}, headers=headers)
    assert res.status_code == 200, res.body
    assert "error" not in res.body, res.body
    return res.body


def call_tool_expect_error(name: str, params: dict, headers: dict | None = None) -> str:
    res = server.make_request("POST", "/tools", data={"tool": name, "params": params}, headers=headers)
    assert res.status_code == 200, res.body
    assert "error" in res.body, res.body
    return res.body["error"]


def test_exec_shell_command_blocks_paths_outside_workspace(tmp_path):
    global server
    server.start()

    workdir = tmp_path / "workdir"
    workdir.mkdir()
    outside = tmp_path / "outside.txt"
    outside.write_text("secret")

    headers = {"x-tool-cwd": str(workdir)}

    # an absolute path outside the workspace is rejected before the command runs
    abs_cmd = f"type {outside}" if os.name == "nt" else f"cat {outside}"
    err = call_tool_expect_error("exec_shell_command", {"command": abs_cmd}, headers=headers)
    assert "workspace" in err

    # so are ".." segments that escape the workspace
    rel_cmd = "type ..\\outside.txt" if os.name == "nt" else "cat ../outside.txt"
    err = call_tool_expect_error("exec_shell_command", {"command": rel_cmd}, headers=headers)
    assert "workspace" in err

    # reading inside the workspace stays legal
    (workdir / "inside.txt").write_text("inside-ok")
    ok_cmd = "type inside.txt" if os.name == "nt" else "cat inside.txt"
    res = call_tool("exec_shell_command", {"command": ok_cmd}, headers=headers)
    assert "inside-ok" in res["plain_text_response"]


def test_exec_shell_command_allowlist(monkeypatch):
    global server
    monkeypatch.setenv("LLAMA_TOOLS_ALLOWLIST", "echo")
    server.start()

    res = call_tool("exec_shell_command", {"command": "echo allowed-binary"})
    assert "allowed-binary" in res["plain_text_response"]

    err = call_tool_expect_error("exec_shell_command", {"command": "git --version"})
    assert "LLAMA_TOOLS_ALLOWLIST" in err

    # every command in a pipeline or sequence must be allowed, not only the first
    err = call_tool_expect_error("exec_shell_command", {"command": "echo a && git --version"})
    assert "LLAMA_TOOLS_ALLOWLIST" in err
