#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import concurrent.futures
import json
import os
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

BASE_DIR = Path(__file__).resolve().parent
LLAMA_URL = os.environ.get("LLAMA_URL", "http://127.0.0.1:8080").rstrip("/")
DEFAULT_MODEL = os.environ.get("LLAMA_MODEL", "")
DEFAULT_WORKSPACE = os.environ.get("AGENT_WORKSPACE", "").strip()
MAX_STEPS = int(os.environ.get("AGENT_MAX_STEPS", "10"))
MAX_TOKENS = int(os.environ.get("AGENT_MAX_TOKENS", "2048"))
TEMPERATURE = float(os.environ.get("AGENT_TEMPERATURE", "0.2"))
HTTP_TIMEOUT = int(os.environ.get("AGENT_HTTP_TIMEOUT", "600"))
MAX_TOOL_CHARS = int(os.environ.get("AGENT_MAX_TOOL_CHARS", "12000"))
MAX_DELEGATIONS = int(os.environ.get("AGENT_MAX_DELEGATIONS", "8"))
PARALLELISM = max(1, int(os.environ.get("AGENT_PARALLELISM", "4")))
DEFAULT_AGENT_TIMEOUT = int(os.environ.get("AGENT_AGENT_TIMEOUT", "300"))
MAX_AGENT_TIMEOUT = int(os.environ.get("AGENT_TIMEOUT_MAX", "3600"))

READ_TOOLS = ["read_file", "file_glob_search", "grep_search", "get_info"]
WRITE_TOOLS = ["write_file", "edit_file", "exec_shell_command"]
ALL_TOOLS = READ_TOOLS + WRITE_TOOLS

AGENT_PROMPTS = {
    "planner": (
        "Eres un arquitecto de software. Analiza la tarea y produce un plan de ejecucion detallado. "
        "Solo puedes usar herramientas de lectura. No escribas archivos ni ejecutes comandos. "
        "Verifica el estado real del proyecto antes de planificar y no inventes archivos ni APIs. "
        "Devuelve: objetivo, suposiciones, pasos numerados con archivos afectados, riesgos y criterios de aceptacion."
    ),
    "analyst": (
        "Eres un analista de requerimientos. Inspecciona el proyecto y convierte la solicitud en requisitos "
        "concretos, criterios de aceptacion y tareas tecnicas. Solo lectura. Senala ambiguedades y supuestos."
    ),
    "developer": (
        "Eres un ingeniero de software autonomo. Implementa la tarea completa usando las herramientas. "
        "Inspecciona antes de modificar, haz cambios minimos y coherentes con el estilo existente, "
        "verifica con build/tests/lint y corrige hasta que pase. No inventes salidas de comandos. "
        "Al terminar informa archivos cambiados, comandos ejecutados y resultado de la verificacion."
    ),
    "frontend": (
        "Eres un ingeniero frontend. Implementa la parte de UI/UX de la tarea. "
        "Respeta el stack, estilos y componentes existentes; verifica con el build/lint disponible. "
        "No toques logica de backend salvo que sea imprescindible. Informa archivos y verificacion."
    ),
    "backend": (
        "Eres un ingeniero backend. Implementa la logica de servidor, API, base de datos y tests de la tarea. "
        "Respeta el stack y las convenciones existentes; verifica con build/tests. "
        "No toques la UI salvo que sea imprescindible. Informa archivos y verificacion."
    ),
    "tester": (
        "Eres un ingeniero de QA. Disena y ejecuta pruebas para verificar la tarea. "
        "Puedes crear/editar tests y ejecutar comandos. Reporta fallos con evidencia exacta "
        "(comando, salida, archivo y linea) y no corrijas el codigo de produccion."
    ),
    "reviewer": (
        "Eres un revisor de codigo. Solo lectura. Revisa correctitud, seguridad, rendimiento y "
        "cumplimiento de los criterios de aceptacion. Reporta hallazgos priorizados con archivo y linea."
    ),
}

ROLES = {
    "planner": {"description": "Planifica sin ejecutar", "tools": READ_TOOLS},
    "analyst": {"description": "Analiza requerimientos", "tools": READ_TOOLS},
    "developer": {"description": "Implementa de principio a fin", "tools": ALL_TOOLS},
    "frontend": {"description": "Implementa UI/frontend", "tools": ALL_TOOLS},
    "backend": {"description": "Implementa backend/API", "tools": ALL_TOOLS},
    "tester": {"description": "Crea y ejecuta pruebas", "tools": ALL_TOOLS},
    "reviewer": {"description": "Revisa sin modificar", "tools": READ_TOOLS},
}

ROLE_ALIASES = {
    "planificador": "planner",
    "analista": "analyst",
    "desarrollador": "developer",
    "probador": "tester",
    "revisor": "reviewer",
}

MODE_FILES = {
    "planificador": "prompts/planificador.md",
    "desarrollador": "prompts/desarrollador.md",
    "orquestador": "prompts/orquestador.md",
}

FALLBACK_MODES = {
    "planificador": "MODO PLANIFICADOR: analiza y produce un plan. No escribas archivos ni ejecutes comandos.",
    "desarrollador": "MODO DESARROLLADOR: implementa la tarea usando las herramientas y verifica el resultado.",
    "orquestador": (
        "MODO ORQUESTADOR: descompone la tarea y delega en agents_spawn_agent "
        "(secuencial) o agents_spawn_agents (independientes en paralelo). "
        "No implementes ni ejecutes comandos directamente."
    ),
}


def log(message):
    print(f"[orchestrator] {message}", file=sys.stderr, flush=True)


KEY_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def resolve_timeout(raw):
    if raw is None:
        return DEFAULT_AGENT_TIMEOUT
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return DEFAULT_AGENT_TIMEOUT
    return max(1, min(value, MAX_AGENT_TIMEOUT))


def resolve_key(raw, index):
    if raw is None:
        return None
    key = str(raw).strip()
    if not KEY_PATTERN.match(key):
        raise ValueError(f"agente #{index}: key invalida {key!r} (solo [A-Za-z0-9_-], 1-64 chars)")
    return key


def resolve_depends_on(raw, index):
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ValueError(f"agente #{index}: depends_on debe ser una lista de keys")
    deps = []
    for dep in raw:
        if not isinstance(dep, str):
            raise ValueError(f"agente #{index}: depends_on solo acepta strings, recibido {dep!r}")
        deps.append(dep.strip())
    return deps


def validate_batch(agents):
    keys = {}
    for i, spec in enumerate(agents):
        key = resolve_key(spec.get("key"), i)
        if key is not None:
            if key in keys:
                raise ValueError(f"agente #{i}: key duplicada {key!r}")
            keys[key] = i

    for i, spec in enumerate(agents):
        own = resolve_key(spec.get("key"), i)
        for dep in resolve_depends_on(spec.get("depends_on"), i):
            if dep not in keys:
                raise ValueError(f"agente #{i}: depends_on referencia una key desconocida: {dep!r}")
            if dep == own:
                raise ValueError(f"agente #{i}: depends_on referencia a si mismo")

    deps_by_index = {}
    for i, spec in enumerate(agents):
        deps_by_index[i] = [keys[d] for d in resolve_depends_on(spec.get("depends_on"), i)]

    # Kahn: detect cycles
    indegree = {i: len(deps) for i, deps in deps_by_index.items()}
    dependents = {i: [] for i in range(len(agents))}
    for i, deps in deps_by_index.items():
        for dep in deps:
            dependents[dep].append(i)

    queue = [i for i, deg in indegree.items() if deg == 0]
    seen = 0
    while queue:
        current = queue.pop()
        seen += 1
        for dependent in dependents[current]:
            indegree[dependent] -= 1
            if indegree[dependent] == 0:
                queue.append(dependent)

    if seen != len(agents):
        cyclic = sorted(i for i, deg in indegree.items() if deg > 0)
        raise ValueError(f"dependencias ciclicas entre agentes #{cyclic}")

    return deps_by_index


def normalize_role(role):
    key = (role or "").strip().lower()
    return ROLE_ALIASES.get(key, key)


def load_modes():
    modes = {}
    for name, rel in MODE_FILES.items():
        path = BASE_DIR / rel
        try:
            modes[name] = path.read_text(encoding="utf-8").strip()
        except OSError:
            modes[name] = FALLBACK_MODES[name]
    return modes


def http_json(method, path, payload=None, headers=None):
    url = LLAMA_URL + path
    response = requests.request(
        method,
        url,
        json=payload,
        headers=headers or {},
        timeout=HTTP_TIMEOUT,
    )
    response.raise_for_status()
    return response.json()


def fetch_tools():
    try:
        data = http_json("GET", "/tools")
    except Exception as exc:
        log(f"no se pudo leer /tools: {exc}")
        return {}
    tools = {}
    for entry in data if isinstance(data, list) else []:
        name = entry.get("tool")
        definition = entry.get("definition")
        if name and definition:
            tools[name] = definition
    return tools


def call_tool(name, params, workspace):
    headers = {}
    if workspace:
        headers["x-tool-cwd"] = workspace
    data = http_json("POST", "/tools", {"tool": name, "params": params}, headers)
    if isinstance(data, dict):
        if data.get("error"):
            return f"ERROR: {data['error']}"
        if "plain_text_response" in data:
            return str(data["plain_text_response"])
        return json.dumps(data, ensure_ascii=False)
    return str(data)


def chat(messages, tools, model):
    payload = {
        "model": model or DEFAULT_MODEL or "local",
        "messages": messages,
        "temperature": TEMPERATURE,
        "max_tokens": MAX_TOKENS,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"
    data = http_json("POST", "/v1/chat/completions", payload)
    return data["choices"][0]["message"]


def run_agent(role, task, model=None, workspace=None, max_steps=None, on_event=None):
    role = normalize_role(role)

    def emit(kind, payload):
        if on_event is not None:
            try:
                on_event(kind, payload)
            except Exception as exc:  # tracing must never break the agent
                log(f"trace callback failed: {exc}")

    if role not in ROLES:
        raise ValueError(f"rol desconocido: {role}. roles validos: {', '.join(ROLES)}")

    steps = max(1, min(int(max_steps or MAX_STEPS), 40))
    cwd = (workspace or DEFAULT_WORKSPACE or "").strip()
    if cwd:
        cwd_path = Path(cwd).expanduser()
        if not cwd_path.is_dir():
            raise ValueError(f"workspace no existe o no es un directorio: {cwd}")
        cwd = str(cwd_path.resolve())
    available = fetch_tools()
    allowed = [name for name in ROLES[role]["tools"] if name in available]
    definitions = [available[name] for name in allowed]

    messages = [
        {"role": "system", "content": AGENT_PROMPTS[role]},
        {"role": "user", "content": task},
    ]
    trace = []
    started = time.monotonic()
    emit("agent_start", {"role": role})

    for _ in range(steps):
        message = chat(messages, definitions, model)
        tool_calls = message.get("tool_calls") or []
        content = message.get("content") or ""

        if not tool_calls:
            content = content.strip() or (message.get("reasoning_content") or "").strip()
            if not content:
                content = "[el agente no devolvio contenido]"
            emit("agent_end", {"role": role, "elapsed": round(time.monotonic() - started, 3)})
            return {"role": role, "content": content, "tools_used": trace}

        messages.append(
            {"role": "assistant", "content": content, "tool_calls": tool_calls}
        )

        for call in tool_calls:
            function = call.get("function") or {}
            name = function.get("name") or ""
            try:
                arguments = json.loads(function.get("arguments") or "{}")
            except json.JSONDecodeError:
                arguments = {}

            if name not in allowed:
                result = f"ERROR: la herramienta '{name}' no esta permitida para el rol {role}"
            else:
                try:
                    result = call_tool(name, arguments, cwd)
                except Exception as exc:
                    result = f"ERROR: {exc}"

            trace.append({"tool": name, "arguments": arguments})
            emit("tool_call", {"role": role, "tool": name, "arguments": arguments})
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call.get("id") or name,
                    "content": result[:MAX_TOOL_CHARS],
                }
            )

    emit("agent_end", {"role": role, "elapsed": round(time.monotonic() - started, 3), "status": "max_steps"})
    return {
        "role": role,
        "content": f"Se alcanzo el limite de {steps} pasos sin respuesta final.",
        "tools_used": trace,
    }


def normalize_key(spec):
    key = spec.get("key")
    return str(key).strip() if key is not None else None


def truncate_args(arguments, limit=160):
    try:
        text = json.dumps(arguments, ensure_ascii=False)
    except Exception:
        text = str(arguments)
    return text if len(text) <= limit else text[:limit] + "…"


def make_event_sink(progress_token):
    state = {"completed": 0}

    def sink(event):
        kind = event.get("kind", "")
        index = event.get("index", "?")
        role = event.get("role", "?")
        if kind == "tool_call":
            message = f"[{index}] {role}: {event.get('tool')}({truncate_args(event.get('arguments'))})"
        elif kind == "agent_start":
            message = f"[{index}] {role}: inicio"
        elif kind == "agent_done":
            message = f"[{index}] {role}: {event.get('status')}"
        elif kind == "agent_queued":
            message = f"[{index}] {role}: encolado"
        else:
            message = f"[{index}] {role}: {kind}"

        log(message)

        if progress_token is None:
            return

        progress_params = {"progressToken": progress_token, "message": message}
        if kind == "agent_done":
            state["completed"] += 1
            progress_params["progress"] = state["completed"]
            total = event.get("total")
            if isinstance(total, int):
                progress_params["total"] = total

        send({"jsonrpc": "2.0", "method": "notifications/progress", "params": progress_params})
        send(
            {
                "jsonrpc": "2.0",
                "method": "notifications/message",
                "params": {"level": "info", "logger": "orchestrator", "data": message},
            }
        )

    return sink


def run_agents(agents, on_event=None):
    if not isinstance(agents, list) or not agents:
        raise ValueError("agents debe ser una lista no vacia")
    if len(agents) > MAX_DELEGATIONS:
        raise ValueError(f"maximo {MAX_DELEGATIONS} agentes por lote")
    if not all(isinstance(agent, dict) for agent in agents):
        raise ValueError("cada agente debe ser un objeto")

    deps_by_index = validate_batch(agents)
    workers = max(1, min(PARALLELISM, len(agents)))
    total = len(agents)

    def emit(event):
        if on_event is None:
            return
        try:
            on_event(event)
        except Exception as exc:  # tracing must never break the scheduler
            log(f"trace callback failed: {exc}")

    def bound_event(index, spec, kind, payload):
        event = {
            "index": index,
            "key": normalize_key(spec),
            "role": normalize_role(str(spec.get("role", ""))),
            "kind": kind,
        }
        event.update(payload)
        return event

    def run_one(index, spec):
        spec_timeout = resolve_timeout(spec.get("timeout"))

        def on_event_local(kind, payload):
            emit(bound_event(index, spec, kind, payload))

        try:
            result = run_agent(
                role=spec.get("role", ""),
                task=spec.get("task", ""),
                model=spec.get("model"),
                workspace=spec.get("workspace"),
                max_steps=spec.get("max_steps"),
                on_event=on_event_local,
            )
            content = str(result.get("content", ""))
            if len(content) > MAX_TOOL_CHARS:
                result["content"] = content[:MAX_TOOL_CHARS] + "\n...[truncado]"
            result["status"] = "ok"
        except Exception as exc:
            log(f"agente {index} fallo: {exc}")
            result = {
                "role": normalize_role(str(spec.get("role", ""))),
                "content": f"ERROR: {exc}",
                "tools_used": [],
                "status": "error",
            }

        result["index"] = index
        if normalize_key(spec) is not None:
            result["key"] = normalize_key(spec)
        if spec.get("depends_on"):
            result["depends_on"] = list(spec["depends_on"])
        return result, spec_timeout

    def skipped_result(index, blocked_by):
        spec = agents[index]
        dep_key = normalize_key(agents[blocked_by])
        label = dep_key if dep_key is not None else f"#{blocked_by}"
        result = {
            "index": index,
            "role": normalize_role(str(spec.get("role", ""))),
            "content": f"ERROR: omitido — la dependencia {label} no termino correctamente",
            "tools_used": [],
            "status": "skipped",
        }
        if normalize_key(spec) is not None:
            result["key"] = normalize_key(spec)
        if spec.get("depends_on"):
            result["depends_on"] = list(spec["depends_on"])
        return result

    def timeout_result(index, spec_timeout):
        spec = agents[index]
        result = {
            "index": index,
            "role": normalize_role(str(spec.get("role", ""))),
            "content": (
                f"ERROR: tiempo limite excedido tras {spec_timeout}s "
                "(el agente puede seguir ejecutandose en segundo plano)"
            ),
            "tools_used": [],
            "status": "timeout",
        }
        if normalize_key(spec) is not None:
            result["key"] = normalize_key(spec)
        if spec.get("depends_on"):
            result["depends_on"] = list(spec["depends_on"])
        return result

    results = [None] * total
    pending = set(range(total))
    in_flight = {}  # future -> (index, started_at, spec_timeout)
    finished = [False] * total
    failed = [False] * total
    done_count = 0

    def finalize(index, ok):
        nonlocal done_count
        finished[index] = True
        failed[index] = not ok
        done_count += 1
        emit(
            bound_event(
                index,
                agents[index],
                "agent_done",
                {
                    "status": results[index].get("status"),
                    "completed": done_count,
                    "total": total,
                },
            )
        )

    pool = ThreadPoolExecutor(max_workers=workers)
    try:
        while pending or in_flight:
            progress = True
            while progress:
                progress = False
                for i in sorted(list(pending)):
                    deps = deps_by_index[i]
                    if not all(finished[d] for d in deps):
                        continue
                    blocked_by = next((d for d in deps if failed[d]), None)
                    if blocked_by is not None:
                        results[i] = skipped_result(i, blocked_by)
                        pending.discard(i)
                        finalize(i, ok=False)
                        progress = True
                        continue
                    emit(bound_event(i, agents[i], "agent_queued", {}))
                    future = pool.submit(run_one, i, agents[i])
                    in_flight[future] = (i, time.monotonic(), resolve_timeout(agents[i].get("timeout")))
                    pending.discard(i)
                    progress = True

            if not in_flight:
                if pending:
                    # validate_batch rules out cycles, so this is unreachable; never hang the caller
                    for i in list(pending):
                        results[i] = {
                            "index": i,
                            "role": normalize_role(str(agents[i].get("role", ""))),
                            "content": "ERROR: scheduler interno",
                            "tools_used": [],
                            "status": "error",
                        }
                        pending.discard(i)
                        finalize(i, ok=False)
                continue

            done_futures, _ = concurrent.futures.wait(
                list(in_flight), timeout=0.05, return_when=concurrent.futures.FIRST_COMPLETED
            )
            now = time.monotonic()
            for future in list(in_flight):
                index, started_at, spec_timeout = in_flight[future]
                if future in done_futures:
                    result, _ = future.result()
                    results[index] = result
                    del in_flight[future]
                    finalize(index, ok=result.get("status") == "ok")
                elif now - started_at >= spec_timeout:
                    results[index] = timeout_result(index, spec_timeout)
                    del in_flight[future]
                    finalize(index, ok=False)
    finally:
        # do not block the caller behind an agent that ignores its deadline;
        # cancelled tasks never start, running ones are left detached
        pool.shutdown(wait=False, cancel_futures=True)

    return {"count": len(results), "parallelism": workers, "results": results}


def format_result(result):
    lines = [f"Rol: {result['role']}", "", result["content"].strip()]
    used = result.get("tools_used") or []
    if used:
        lines.append("")
        lines.append("Herramientas usadas: " + ", ".join(item["tool"] for item in used))
    return "\n".join(lines).strip()


TOOL_SPECS = [
    {
        "name": "spawn_agent",
        "description": (
            "Delega una tarea autocontenida a un agente especializado que trabaja sobre el "
            "proyecto con herramientas reales (leer, escribir, editar, ejecutar) y devuelve "
            "el resultado. Usalo para descomponer trabajo en frontend, backend, analisis, "
            "pruebas o revision."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "role": {
                    "type": "string",
                    "description": "Rol del agente",
                    "enum": list(ROLES.keys()) + list(ROLE_ALIASES.keys()),
                },
                "task": {
                    "type": "string",
                    "description": (
                        "Tarea autocontenida: contexto, archivos relevantes, criterios de "
                        "aceptacion y que debe devolver el agente"
                    ),
                },
                "model": {
                    "type": "string",
                    "description": "Modelo a usar (router mode). Opcional",
                },
                "workspace": {
                    "type": "string",
                    "description": "Directorio de trabajo del agente. Opcional",
                },
                "max_steps": {
                    "type": "integer",
                    "description": f"Maximo de iteraciones (default {MAX_STEPS}, tope 40)",
                },
            },
            "required": ["role", "task"],
        },
    },
    {
        "name": "spawn_agents",
        "description": (
            "Delega varias tareas en un lote y devuelve un resultado por agente "
            f"(maximo {MAX_DELEGATIONS}). Sin depends_on todas se ejecutan en paralelo "
            "(respeta AGENT_PARALLELISM); con depends_on se ejecuta como DAG: un agente "
            "espera a que terminen sus dependencias y se omite si alguna falla. "
            "Usa timeout (segundos) para acotar la espera por agente."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "agents": {
                    "type": "array",
                    "description": (
                        "Lote de agentes. Los que no tengan depends_on corren en paralelo; "
                        "los dependientes esperan a que terminen sus dependencias"
                    ),
                    "minItems": 1,
                    "maxItems": MAX_DELEGATIONS,
                    "items": {
                        "type": "object",
                        "properties": {
                            "role": {
                                "type": "string",
                                "description": "Rol del agente",
                                "enum": list(ROLES.keys()) + list(ROLE_ALIASES.keys()),
                            },
                            "task": {
                                "type": "string",
                                "description": (
                                    "Tarea autocontenida: contexto, archivos relevantes, "
                                    "criterios de aceptacion y que debe devolver"
                                ),
                            },
                            "model": {
                                "type": "string",
                                "description": "Modelo a usar (router mode). Opcional",
                            },
                            "workspace": {
                                "type": "string",
                                "description": "Directorio de trabajo del agente. Opcional",
                            },
                            "max_steps": {
                                "type": "integer",
                                "description": (
                                    f"Maximo de iteraciones (default {MAX_STEPS}, tope 40)"
                                ),
                            },
                            "key": {
                                "type": "string",
                                "description": (
                                    "Identificador unico del agente dentro del lote "
                                    "([A-Za-z0-9_-], 1-64 chars). Requerido si otros "
                                    "agentes dependen de este"
                                ),
                            },
                            "depends_on": {
                                "type": "array",
                                "description": (
                                    "Keys de agentes de este mismo lote que deben terminar "
                                    "antes de que este agente empiece. Si alguna dependencia "
                                    "falla, este agente se omite"
                                ),
                                "items": {"type": "string"},
                            },
                            "timeout": {
                                "type": "integer",
                                "description": (
                                    f"Tiempo limite en segundos para acotar la espera de este "
                                    f"agente (default {DEFAULT_AGENT_TIMEOUT}, tope {MAX_AGENT_TIMEOUT})"
                                ),
                            },
                        },
                        "required": ["role", "task"],
                    },
                }
            },
            "required": ["agents"],
        },
    },
    {
        "name": "list_agents",
        "description": "Lista los roles de agente disponibles, su descripcion y herramientas.",
        "inputSchema": {"type": "object", "properties": {}},
    },
]


def execute_tool(name, arguments, progress_token=None):
    if name == "spawn_agent":
        on_event = make_event_sink(progress_token) if progress_token is not None else None
        result = run_agent(
            role=arguments.get("role", ""),
            task=arguments.get("task", ""),
            model=arguments.get("model"),
            workspace=arguments.get("workspace"),
            max_steps=arguments.get("max_steps"),
            on_event=on_event,
        )
        return format_result(result)

    if name == "spawn_agents":
        on_event = make_event_sink(progress_token)
        result = run_agents(arguments.get("agents") or [], on_event=on_event)
        return json.dumps(result, ensure_ascii=False, indent=2)

    if name == "list_agents":
        payload = {
            role: {"description": spec["description"], "tools": spec["tools"]}
            for role, spec in ROLES.items()
        }
        return json.dumps(payload, ensure_ascii=False, indent=2)

    raise ValueError(f"herramienta desconocida: {name}")


_stdout_lock = threading.Lock()


def send(message):
    with _stdout_lock:
        sys.stdout.write(json.dumps(message, ensure_ascii=False) + "\n")
        sys.stdout.flush()


def respond(request_id, result):
    if request_id is None:
        return
    send({"jsonrpc": "2.0", "id": request_id, "result": result})


def respond_error(request_id, code, message):
    if request_id is None:
        return
    send({"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}})


def main():
    for stream in (sys.stdin, sys.stdout):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            try:
                reconfigure(encoding="utf-8")
            except Exception:
                pass

    modes = load_modes()
    log(f"listo. llama-server={LLAMA_URL} workspace={DEFAULT_WORKSPACE or '(cwd)'}")

    for raw in sys.stdin:
        raw = raw.strip()
        if not raw:
            continue
        try:
            request = json.loads(raw)
        except json.JSONDecodeError:
            continue

        method = request.get("method")
        request_id = request.get("id")
        params = request.get("params") or {}

        try:
            if method == "initialize":
                respond(
                    request_id,
                    {
                        "protocolVersion": params.get("protocolVersion", "2024-11-05"),
                        "capabilities": {"tools": {}, "prompts": {}},
                        "serverInfo": {"name": "llama-agents", "version": "1.0.0"},
                    },
                )
            elif method in ("notifications/initialized", "initialized", "notifications/cancelled"):
                continue
            elif method == "ping":
                respond(request_id, {})
            elif method == "tools/list":
                respond(request_id, {"tools": TOOL_SPECS})
            elif method == "tools/call":
                name = params.get("name", "")
                arguments = params.get("arguments") or {}
                meta = params.get("_meta")
                if not isinstance(meta, dict):
                    meta = {}
                progress_token = meta.get("progressToken")
                if not isinstance(progress_token, (str, int, float)):
                    progress_token = None
                try:
                    text = execute_tool(name, arguments, progress_token=progress_token)
                    respond(
                        request_id,
                        {"content": [{"type": "text", "text": text}], "isError": False},
                    )
                except Exception as exc:
                    respond(
                        request_id,
                        {
                            "content": [{"type": "text", "text": f"ERROR: {exc}"}],
                            "isError": True,
                        },
                    )
            elif method == "prompts/list":
                respond(
                    request_id,
                    {
                        "prompts": [
                            {
                                "name": name,
                                "description": f"System prompt del modo {name}",
                                "arguments": [],
                            }
                            for name in modes
                        ]
                    },
                )
            elif method == "prompts/get":
                name = params.get("name", "")
                if name not in modes:
                    respond_error(request_id, -32602, f"prompt desconocido: {name}")
                else:
                    respond(
                        request_id,
                        {
                            "description": f"Modo {name}",
                            "messages": [
                                {
                                    "role": "user",
                                    "content": {"type": "text", "text": modes[name]},
                                }
                            ],
                        },
                    )
            elif method == "resources/list":
                respond(request_id, {"resources": []})
            elif method == "resources/templates/list":
                respond(request_id, {"resourceTemplates": []})
            elif method == "shutdown":
                respond(request_id, {})
                break
            elif method == "exit":
                break
            else:
                respond_error(request_id, -32601, f"metodo no soportado: {method}")
        except Exception as exc:
            log(f"error en {method}: {exc}")
            respond_error(request_id, -32603, str(exc))


if __name__ == "__main__":
    main()
