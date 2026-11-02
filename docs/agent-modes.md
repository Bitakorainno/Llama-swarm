# Agent modes (fork)

This fork adds three agent modes on top of `llama-server`'s built-in tool
support. Modes live in the chat UI and only change the prompt, the enabled
tools and the default working directory of a conversation.

## Modes

| Mode          | ID             | Tools                       | Purpose                                           |
| ------------- | -------------- | --------------------------- | ------------------------------------------------- |
| Desarrollador | `developer`    | read, write, edit, exec     | Implement and verify changes end to end           |
| Planificador  | `planner`      | read only                   | Analyse and produce a plan without touching files |
| Orquestador   | `orchestrator` | read + `agents_spawn_agent` | Split work and delegate to subagents              |

The mode is stored per conversation (`agentProfileId`) together with its tool
policy (`disabledTools`, `disabledToolCategories`) and the base system prompt.
Switching to "Sin modo" restores the previous base prompt and clears the
policy.

## Default workspace

Modes used to pin a hard-coded path. The default workspace is now the
**Agent workspace** setting under _Settings → Agentic_. It is applied only
when a conversation starts with a mode and no directory was picked
explicitly; an empty value leaves the server/MCP default in place.

The launcher still reads `AGENT_WORKSPACE` for subagents spawned through
`orchestrator_mcp.py`, so keep that value in sync with the UI setting if you
plan to use the orchestrator.

## Permissions

Applying a mode pre-approves its read-only tools (plus subagent delegation for
the orchestrator) so the agentic loop does not prompt for each call. Tools
granted this way are tracked and revoked when the mode changes or is removed.
Permissions the user granted manually are left untouched.

## Security note

`exec_shell_command` runs on the host **without a sandbox**, and the fork
starts `llama-server` with tools enabled. A mode can therefore read, modify
and execute anything the server process can access. In particular:

- Only point the agent workspace at directories you are willing to let the
  model modify.
- Do not expose `llama-server` to untrusted networks while tools are enabled.
- The developer and orchestrator modes are powerful by design; review their
  output before relying on it.
- Subagents spawned by the orchestrator inherit the same host access.
