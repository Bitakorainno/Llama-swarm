# Agent modes (fork)

This fork adds three agent modes on top of `llama-server`'s built-in tool
support. Modes live in the chat UI and only change the prompt, the enabled
tools and the default working directory of a conversation.

## Modes

| Mode          | ID             | Tools                       | Purpose                                           |
| ------------- | -------------- | --------------------------- | ------------------------------------------------- |
| Desarrollador | `developer`    | read, write, edit, exec     | Implement and verify changes end to end           |
| Planificador  | `planner`      | read only                   | Analyse and produce a plan without touching files |
| Orquestador | `orchestrator` | read + `agents_spawn_agent` / `agents_spawn_agents` | Split work and delegate to subagents sequentially or in parallel |

The mode is stored per conversation (`agentProfileId`) together with its tool
policy (`disabledTools`, `disabledToolCategories`) and the base system prompt.
Switching to "Sin modo" restores the previous base prompt and clears the
policy.

## Default workspace

Modes used to pin a hard-coded path. The default workspace is now the
**Agent workspace** setting under _Settings → Agentic_. It is applied only
when a conversation starts with a mode and no directory was picked
explicitly; an empty value leaves the server/MCP default in place.

The launcher sets `AGENT_WORKSPACE` to `<basedir>/Proyects` only when the
variable is not already defined, so exporting it before launching overrides
the default. `mcp.json` no longer contains absolute paths: it spawns
`orchestrator_mcp.bat`, which selects `AGENT_PYTHON`, `py -3` or `python`, in
that order.

## Parallel delegation

`orchestrator_mcp.py` exposes two tools:

- `agents_spawn_agent`: one subagent, sequential.
- `agents_spawn_agents`: a batch of independent subagents run with a thread
  pool. Batches are capped by `AGENT_MAX_DELEGATIONS` (default 8) and
  parallelism by `AGENT_PARALLELISM` (default 4).

Use the batch tool only for tasks without dependencies. Dependent steps still
run sequentially with `agents_spawn_agent`.

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
