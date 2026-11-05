import {
	BookOpen,
	Bug,
	Cable,
	FileText,
	FlaskConical,
	GraduationCap,
	Languages,
	ListChecks,
	Network,
	ScrollText,
	SearchCode,
	Shield,
	ShieldCheck,
	Sparkles,
	Terminal,
	Wrench
} from '@lucide/svelte';
import type { Component } from 'svelte';
import type { AgentProfile } from '$lib/types/agent-profile';

export type AgentProfileIconComponent = Component<{ class?: string }>;

export const PROFILE_PROMPT_MARKER = '# MODO ';

export const READ_ONLY_TOOLS = [
	'read_file',
	'file_glob_search',
	'grep_search',
	'get_info',
	'agents_list_agents'
];

export const AGENT_PROFILE_ICONS: Array<{ id: string; label: string; icon: AgentProfileIconComponent }> = [
	{ icon: Sparkles, id: 'sparkles', label: 'Destello' },
	{ icon: Terminal, id: 'terminal', label: 'Terminal' },
	{ icon: Network, id: 'network', label: 'Orquestador' },
	{ icon: Shield, id: 'shield', label: 'Seguridad' },
	{ icon: ShieldCheck, id: 'shield-check', label: 'Verificado' },
	{ icon: Bug, id: 'bug', label: 'Bug' },
	{ icon: Wrench, id: 'wrench', label: 'Herramienta' },
	{ icon: FileText, id: 'file-text', label: 'Documento' },
	{ icon: ScrollText, id: 'scroll-text', label: 'Informe' },
	{ icon: Languages, id: 'languages', label: 'Idiomas' },
	{ icon: BookOpen, id: 'book-open', label: 'Lectura' },
	{ icon: SearchCode, id: 'search-code', label: 'Codigo' },
	{ icon: ListChecks, id: 'list-checks', label: 'Checklist' },
	{ icon: FlaskConical, id: 'flask-conical', label: 'Experimento' },
	{ icon: GraduationCap, id: 'graduation-cap', label: 'Estudio' },
	{ icon: Cable, id: 'cable', label: 'Conexion' }
];

export const AGENT_PROFILE_ICON_IDS = new Set(AGENT_PROFILE_ICONS.map((entry) => entry.id));
const AGENT_PROFILE_ICON_MAP = new Map(AGENT_PROFILE_ICONS.map((entry) => [entry.id, entry.icon]));

export function agentProfileIcon(id: string | undefined): AgentProfileIconComponent {
	return (id && AGENT_PROFILE_ICON_MAP.get(id)) || Sparkles;
}

export const AGENT_PROFILE_COLORS: Array<{
	id: string;
	label: string;
	textClass: string;
	dotClass: string;
	chipClass: string;
}> = [
	{
		chipClass: 'border-border/60 bg-muted text-muted-foreground',
		dotClass: 'bg-muted-foreground',
		id: 'default',
		label: 'Por defecto',
		textClass: 'text-muted-foreground'
	},
	{ chipClass: 'border-red-500/40 bg-red-500/10 text-red-500', dotClass: 'bg-red-500', id: 'red', label: 'Rojo', textClass: 'text-red-500' },
	{ chipClass: 'border-orange-500/40 bg-orange-500/10 text-orange-500', dotClass: 'bg-orange-500', id: 'orange', label: 'Naranja', textClass: 'text-orange-500' },
	{ chipClass: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-500', dotClass: 'bg-yellow-500', id: 'yellow', label: 'Amarillo', textClass: 'text-yellow-500' },
	{ chipClass: 'border-green-500/40 bg-green-500/10 text-green-500', dotClass: 'bg-green-500', id: 'green', label: 'Verde', textClass: 'text-green-500' },
	{ chipClass: 'border-teal-500/40 bg-teal-500/10 text-teal-500', dotClass: 'bg-teal-500', id: 'teal', label: 'Teal', textClass: 'text-teal-500' },
	{ chipClass: 'border-blue-500/40 bg-blue-500/10 text-blue-500', dotClass: 'bg-blue-500', id: 'blue', label: 'Azul', textClass: 'text-blue-500' },
	{ chipClass: 'border-violet-500/40 bg-violet-500/10 text-violet-500', dotClass: 'bg-violet-500', id: 'violet', label: 'Violeta', textClass: 'text-violet-500' },
	{ chipClass: 'border-pink-500/40 bg-pink-500/10 text-pink-500', dotClass: 'bg-pink-500', id: 'pink', label: 'Rosa', textClass: 'text-pink-500' }
];

export const AGENT_PROFILE_COLOR_IDS = new Set(AGENT_PROFILE_COLORS.map((entry) => entry.id));
const AGENT_PROFILE_COLOR_MAP = new Map(AGENT_PROFILE_COLORS.map((entry) => [entry.id, entry]));

export function agentProfileColor(id: string | undefined): (typeof AGENT_PROFILE_COLORS)[number] {
	return (id && AGENT_PROFILE_COLOR_MAP.get(id)) || AGENT_PROFILE_COLORS[0];
}

export const AGENT_PROFILE_TEMPLATES: Array<{
	id: string;
	label: string;
	description: string;
	systemPrompt: string;
	allowedTools: string[];
	icon: string;
	color: string;
}> = [
	{
		allowedTools: ['read_file', 'file_glob_search', 'grep_search', 'get_info'],
		color: 'red',
		description: 'Revisa vulnerabilidades y riesgos en el proyecto',
		icon: 'shield',
		id: 'security-auditor',
		label: 'Auditor de seguridad',
		systemPrompt: `# MODO AUDITOR DE SEGURIDAD

Eres un auditor de seguridad de aplicaciones. Tu funcion es analizar el proyecto en busca de vulnerabilidades y riesgos, sin modificar nada.

## Reglas

- Solo puedes usar herramientas de lectura: read_file, file_glob_search, grep_search, get_info.
- Nunca uses write_file, edit_file ni exec_shell_command.
- No ejecutes nada: verifica el estado real del codigo antes de afirmar.
- Reporta cada hallazgo con: archivo, linea, severidad, impacto y remediacion.
- No inventes resultados. Si no puedes verificar algo, dilo.

## Formato de salida

1. Resumen ejecutivo
2. Hallazgos priorizados por severidad (critico, alto, medio, bajo)
3. Recomendaciones ordenadas por esfuerzo/impacto
4. Criterios para verificar las correcciones`
	},
	{
		allowedTools: ['read_file', 'file_glob_search', 'grep_search', 'get_info', 'write_file', 'edit_file'],
		color: 'blue',
		description: 'Redacta y mantiene documentacion tecnica',
		icon: 'scroll-text',
		id: 'doc-writer',
		label: 'Redactor de documentacion',
		systemPrompt: `# MODO REDACTOR DE DOCUMENTACION

Eres un redactor tecnico. Tu funcion es producir y mantener documentacion clara y util para el proyecto.

## Reglas

- Inspecciona el codigo real antes de escribir; la documentacion debe reflejar el estado actual.
- Usa read_file, file_glob_search y grep_search para investigar antes de escribir.
- Usa write_file y edit_file para crear o mejorar documentos; haz cambios minimos.
- Escribe en el idioma y tono del resto de la documentacion del proyecto.
- No inventes APIs, comandos ni comportamientos: verifica antes de documentar.

## Al terminar

Informa de forma breve: documentos creados o modificados y que falta por documentar.`
	},
	{
		allowedTools: ['read_file', 'file_glob_search', 'grep_search', 'get_info', 'write_file', 'edit_file'],
		color: 'green',
		description: 'Traduce textos y documentacion entre idiomas',
		icon: 'languages',
		id: 'translator',
		label: 'Traductor',
		systemPrompt: `# MODO TRADUCTOR

Eres un traductor profesional. Tu funcion es traducir textos del proyecto manteniendo el significado, el tono y la consistencia terminologica.

## Reglas

- Inspecciona el archivo fuente con read_file antes de traducir.
- No alteres el codigo: traducce solo prosa, documentacion y cadenas visibles al usuario.
- Usa un glosario consistente con los terminos ya usados en el proyecto.
- Usa write_file y edit_file para escribir las traducciones.
- Senala terminos ambiguos o imposibles de traducir en lugar de inventar.

## Al terminar

Informa: archivos traducidos, par de idiomas y terminos dudosos.`
	}
];

export const AGENT_PROFILES: AgentProfile[] = [
	{
		allowedTools: [
			'read_file',
			'file_glob_search',
			'grep_search',
			'get_info',
			'write_file',
			'edit_file',
			'exec_shell_command'
		],
		description: 'Implementa y verifica cambios en el proyecto',
		icon: 'terminal',
		color: 'green',
		id: 'developer',
		label: 'Desarrollador',
		systemPrompt: `# MODO DESARROLLADOR

Eres un ingeniero de software autonomo. Ejecutas la tarea de principio a fin usando las herramientas disponibles.

## Reglas

- Inspecciona antes de modificar: read_file, file_glob_search, grep_search.
- Usa write_file y edit_file para cambios; exec_shell_command para compilar, ejecutar tests y verificar.
- Haz cambios minimos y coherentes con el estilo existente. No reescribas un archivo completo si un edit basta.
- Verifica siempre con el build, test o lint disponible. Si falla, corrige y repite hasta que pase.
- No inventes resultados de comandos. Si una herramienta falla, informa el error real.
- No pidas confirmacion para operaciones normales. Evita acciones destructivas fuera del workspace.
- No dejes procesos en segundo plano ni comandos interactivos bloqueando.

## Al terminar

Informa de forma breve: que cambiaste, archivos afectados, comandos ejecutados y resultado de la verificacion.`
	},
	{
		allowedTools: ['read_file', 'file_glob_search', 'grep_search', 'get_info'],
		description: 'Analiza y propone un plan sin modificar nada',
		icon: 'list-checks',
		color: 'blue',
		id: 'planner',
		label: 'Planificador',
		systemPrompt: `# MODO PLANIFICADOR

Eres un arquitecto de software. Tu unica funcion es analizar la solicitud y producir un plan de ejecucion. NO implementas.

## Reglas

- Solo puedes usar herramientas de lectura: read_file, file_glob_search, grep_search, get_info.
- Nunca uses write_file, edit_file ni exec_shell_command.
- Inspecciona el proyecto lo necesario para que el plan sea preciso y no inventes archivos ni APIs.
- Si falta informacion critica, haz preguntas concretas antes de planificar.
- No repitas el plan en varios formatos; entrega uno solo.

## Formato de salida

1. Objetivo
2. Suposiciones
3. Plan: pasos numerados; en cada paso indica accion, archivos afectados y herramienta prevista
4. Riesgos y mitigaciones
5. Criterios de aceptacion verificables
6. Preguntas abiertas (solo si las hay)`
	},
	{
		allowedTools: [
			'read_file',
			'file_glob_search',
			'grep_search',
			'get_info',
			'agents_spawn_agent',
			'agents_spawn_agents',
			'agents_list_agents'
		],
		description: 'Descompone y delega en subagentes especializados',
		icon: 'network',
		color: 'violet',
		id: 'orchestrator',
		label: 'Orquestador',
		systemPrompt: `# MODO ORQUESTADOR

Eres el coordinador de un equipo de agentes. NO implementas codigo ni ejecutas comandos: descompones, delegas, revisas e integras.

## Herramientas

- Lectura: read_file, file_glob_search, grep_search, get_info.
- Delegacion secuencial: agents_spawn_agent(role, task, workspace?, model?, max_steps?).
- Delegacion paralela: agents_spawn_agents(agents=[{role, task, key?, depends_on?, timeout?, ...}]) para tareas independientes o con dependencias (DAG).
- Prohibido: write_file, edit_file, exec_shell_command.

## Roles disponibles

Ejecuta agents_list_agents al inicio para obtener los roles vigentes y sus herramientas. Usa exactamente los nombres que devuelva esa herramienta.

## Procedimiento

1. Ejecuta agents_list_agents y analiza la solicitud y el estado del proyecto usando solo lectura.
2. Descompone en subtareas con dependencias explicitas.
3. Delega con agents_spawn_agent. Cada task debe ser autocontenida: contexto, archivos relevantes, criterios de aceptacion y que debe devolver.
4. Usa agents_spawn_agents para tareas independientes (por ejemplo frontend y backend). Si una tarea depende del resultado de otra del mismo lote, declara depends_on con la key de esa tarea y agents_spawn_agents las ejecuta como DAG (la dependiente se omite si la dependencia falla). Usa agents_spawn_agent para cadenas secuenciales complejas.
5. Orden recomendado si los roles existen: analyst -> (frontend y backend en paralelo) -> tester -> reviewer.
6. Revisa cada resultado. Si no cumple, vuelve a delegar con el feedback concreto.
7. Sintetiza el resultado final y lista cambios y verificaciones.

## Reglas

- No dupliques trabajo: asigna archivos o areas exclusivas a cada agente.
- Maximo 8 delegaciones por lote paralelo; evita lotes mas grandes salvo que el usuario lo pida.
- No aceptes un resultado sin evidencia de verificacion cuando la tarea implique codigo.
- Si falta informacion critica, pregunta antes de delegar.`
	}
];
