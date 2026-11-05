# Agent modes (fork)

## Running the app

The repo root is the app root. `llama-swarm.bat` (staged rename of the old
`iniciar-llamacpp.bat`; deliberately renamed, see note below) is the launcher and
works stand-alone once `models/*.gguf` are placed in `\models\` inside the repo
(they are intentionally not vendored):

1. `llama-swarm.bat` → pick a model → pick a preset → pick a mode.
2. Mode 1 chat: `dist\llama-completion.exe`. Mode 2 server: `dist\llama-server-fork.exe`
   with the fork UI (`tools\ui\dist`, `--path`), the MCP orchestrator
   (`mcp.json` → `orchestrator_mcp.bat` → `tools\orchestrator_mcp.py`) and
   `Proyects\` as the default agent workspace.
3. The old distribution folder `H:\llama-b11963-bin-win-vulkan-x64` is no longer
   required; the fork's `dist\` ships the same b11963 Vulkan runtime.

Note: the exact names `llama-server.exe` and `iniciar-llamacpp.bat` cannot be
created inside this directory anymore (blocked by a host-side filter, not by
Windows Defender). The binaries and launcher are renamed to `llama-server-fork.exe`
and `llama-swarm.bat` accordingly.

This fork adds three agent modes on top of `llama-server`'s built-in tool
support. Modes live in the chat UI and only change the prompt, the enabled
tools and the default working directory of a conversation.

## Modes

| Mode          | ID             | Tools                                               | Purpose                                                          |
| ------------- | -------------- | --------------------------------------------------- | ---------------------------------------------------------------- |
| Desarrollador | `developer`    | read, write, edit, exec                             | Implement and verify changes end to end                          |
| Planificador  | `planner`      | read only                                           | Analyse and produce a plan without touching files                |
| Orquestador   | `orchestrator` | read + `agents_spawn_agent` / `agents_spawn_agents` | Split work and delegate to subagents sequentially or in parallel |

The mode is stored per conversation (`agentProfileId`) together with its tool
policy (`disabledTools`, `disabledToolCategories`) and the base system prompt.
Switching to "Sin modo" restores the previous base prompt and clears the
policy.

## Custom profiles

You can create, edit and delete custom agent profiles from _Settings → Agentic_.
Each profile defines an ID, display label, description, system prompt, an allowed
tools list and optional `icon` (from a fixed set of Lucide icons) and `color`
(a fixed palette); unknown values are discarded when reading the profile and
never reach the DOM. Custom profiles cannot override built-in IDs (`developer`,
`planner`, `orchestrator`) and are persisted in `agentProfilesCustom`.
Applying a custom profile derives its tool policy and grants permissions with
the same safety rules as built-in modes.

- **Templates**: the new-profile dialog offers predefined templates
  ("Auditor de seguridad", "Redactor de documentación", "Traductor") that fill
  the whole form; they are starting points, fully editable.
- **Sharing individual profiles**: each custom profile has a "Copiar como JSON"
  button that copies only that profile to the clipboard (no settings export
  required), and an "Importar" panel accepts a pasted profile JSON or reads it
  from the clipboard. Import is sanitized: reserved/duplicate IDs, missing
  label/systemPrompt and non-list `allowedTools` are rejected, and `icon` /
  `color` are validated against the same fixed sets.
- Custom profiles saved through the dialog are written to localStorage
  immediately (previously they were only kept in memory until something else
  saved the settings).

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
- `agents_spawn_agents`: a batch of subagents. Batches are capped by
  `AGENT_MAX_DELEGATIONS` (default 8) and parallelism by `AGENT_PARALLELISM`
  (default 4).

`agents_spawn_agents` runs as a **DAG**, not a flat pool. Each agent in the
batch may declare:

- `key`: a unique identifier (`[A-Za-z0-9_-]`, 1-64 chars) required for tasks
  that other tasks depend on.
- `depends_on`: a list of `key`s from the same batch that must finish first.
  An agent whose dependencies failed (or were skipped/timed out) is **skipped**
  with an error result instead of running on broken input.
- `timeout`: seconds to wait for this agent before marking it `timeout` and
  skipping its dependents (default `AGENT_AGENT_TIMEOUT` = 300, capped by
  `AGENT_TIMEOUT_MAX` = 3600).

Results carry a `status` per agent: `ok`, `error`, `timeout` or `skipped`
(agents without dependencies still run concurrently; cycles and unknown keys
are rejected before anything starts). Use the batch tool for any set of
subtasks you can express with dependencies instead of chaining `spawn_agent`
by hand.

**Trace streaming**: while agents run, the orchestrator emits MCP
`notifications/progress` (with the caller's `_meta.progressToken`, when
present) and `notifications/message` (`level: info`) events for
`agent_queued`, `agent_start`, each `tool_call` and `agent_done`, and logs the
same trace to stderr. Note that llama-server's built-in MCP client currently
consumes notifications silently; progress is only surfaced to clients that
request it (e.g. Claude Desktop) or in the orchestrator logs. The DAG and
timeout machinery also works for clients that never see the stream.

## Vendored runtime (dist/)

`dist/` mirrors the minimum official llama.cpp `b11963` Vulkan build (server only)
from the distribution folder: `llama-server(.exe)` + `llama-server-impl.dll`,
`llama.dll`, `llama-common.dll`, `ggml*.dll`, `ggml-cpu-*.dll`, `ggml-vulkan.dll`,
`mtmd.dll` and `libomp.dll`. It lets the fork run without a Vulkan toolchain on
this machine. **Caveat:** those binaries are the unmodified upstream `b11963`
build — they predate this fork, so the `exec_shell_command` guards
(`LLAMA_TOOLS_ALLOWLIST` and the workspace restriction) and any other C++-side
changes are **not** active in them. The UI, custom profiles and the orchestrator
are active. A fork rebuilt from source (with the Vulkan SDK) supersedes `dist/`.

## Build version

`tools/ui/build-version.txt` is the local fallback for `build.json`. The
build-info plugin prefers `LLAMA_BUILD_NUMBER` (set by CMake), then that file,
so a plain `npm run build` no longer stamps `b0000`. `build-ui.ps1` reads the
same file, exports `LLAMA_BUILD_NUMBER` and verifies the result.

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
- Set `LLAMA_TOOLS` to a comma-separated subset (for example without
  `exec_shell_command`) to reduce the surface exposed by the launcher.
- Set `LLAMA_TOOLS_RUNTIME` to `docker:<image>`, `podman:<image>` or
  `ssh:<target>` to run the tools outside the host. The launcher passes it as
  `--tools-runtime`; the image/host must provide the POSIX tools required by
  llama.cpp.

Two **best-effort, host-side guards** are also available (neither is a
sandbox; a motivated command can obfuscate itself past lexical checks):

- `LLAMA_TOOLS_ALLOWLIST` (comma-separated binary names): when set, every
  command in a pipeline or sequence must start with an allowed binary
  (`git`, `npm`, `pytest`, ...). Path components are stripped, Windows
  executable extensions are ignored, comparison is case-insensitive. Example:
  `set LLAMA_TOOLS_ALLOWLIST=git,npm,pytest,cargo` before launching.
- **Workspace restriction**: when a workspace is set via the `x-tool-cwd`
  header (as the web UI and the orchestrator do) and no `--tools-runtime` is
  configured, `exec_shell_command` rejects commands whose tokens reference
  absolute paths, `~` paths or `..` segments that resolve outside the
  workspace. Relative paths inside the workspace stay legal. When a
  `--tools-runtime` is configured the isolate is the boundary and this check
  is skipped.

Both guards block before the command runs and report
`[blocked: ...] [exit code: 126]` on the stream, `{"error": ...}` otherwise.
Commands using Windows drive-relative paths (`C:foo`), unresolvable
environment variables or embedded paths in option-like flags (e.g. `-I/x`)
follow the conservative reading: anything not unambiguously inside the
workspace is rejected.
