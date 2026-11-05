import {
	AGENT_PROFILE_COLOR_IDS,
	AGENT_PROFILE_ICON_IDS,
	AGENT_PROFILES,
	READ_ONLY_TOOLS,
	SETTINGS_KEYS
} from '$lib/constants';
import { ToolSource } from '$lib/enums';
import { permissionsStore } from '$lib/stores/permissions.svelte';
import { settingsStore } from '$lib/stores/settings/index.svelte';
import { toolsStore } from '$lib/stores/tools.svelte';
import type { AgentProfile, AgentProfileId } from '$lib/types';

export interface AgentToolPolicy {
	disabledToolCategories?: ToolSource[];
	disabledTools?: string[];
}

const PRE_APPROVED_TOOLS = new Set([
	...READ_ONLY_TOOLS,
	'agents_spawn_agent',
	'agents_spawn_agents'
]);

const RESERVED_PROFILE_IDS = new Set(AGENT_PROFILES.map((p) => p.id));

function sanitizeIcon(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const icon = value.trim();

	return AGENT_PROFILE_ICON_IDS.has(icon) ? icon : undefined;
}

function sanitizeColor(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const color = value.trim();

	return AGENT_PROFILE_COLOR_IDS.has(color) ? color : undefined;
}

/** Recoge un objeto arbitrary del JSON de perfiles y lo normaliza; undefined si es inválido */
export function sanitizeCustomProfile(item: unknown): AgentProfile | undefined {
	if (!item || typeof item !== 'object') return undefined;

	const source = item as Record<string, unknown>;
	const id = typeof source.id === 'string' ? source.id.trim() : '';
	const label = typeof source.label === 'string' ? source.label.trim() : '';
	const description = typeof source.description === 'string' ? source.description.trim() : '';
	const systemPrompt = typeof source.systemPrompt === 'string' ? source.systemPrompt.trim() : '';
	const allowedTools = Array.isArray(source.allowedTools)
		? [...new Set(source.allowedTools.filter((t): t is string => typeof t === 'string' && !!t.trim()))]
		: [];

	if (!id || RESERVED_PROFILE_IDS.has(id as AgentProfileId) || !label || !systemPrompt) {
		return undefined;
	}

	const profile: AgentProfile = {
		allowedTools,
		description,
		id: id as AgentProfileId,
		isCustom: true,
		label,
		systemPrompt
	};
	const icon = sanitizeIcon(source.icon);
	const color = sanitizeColor(source.color);

	if (icon) profile.icon = icon;
	if (color) profile.color = color;

	return profile;
}

class AgentProfilesStore {
	pendingProfileId = $state<AgentProfileId | null>(null);
	private grantedKeys = new Set<string>();

	get defaultWorkspace(): string | undefined {
		const value = settingsStore.config[SETTINGS_KEYS.AGENTIC_WORKSPACE];

		if (typeof value !== 'string') return undefined;

		const trimmed = value.trim();

		return trimmed || undefined;
	}

	get customProfiles(): AgentProfile[] {
		const raw = settingsStore.config[SETTINGS_KEYS.AGENT_PROFILES_CUSTOM];

		if (typeof raw !== 'string' || !raw.trim()) return [];

		try {
			const parsed = JSON.parse(raw);

			if (!Array.isArray(parsed)) return [];

			const builtinIds = new Set(AGENT_PROFILES.map((p) => p.id));
			const result: AgentProfile[] = [];

			for (const item of parsed) {
				const profile = sanitizeCustomProfile(item);

				if (!profile) continue;
				// guardia extra: nunca permitir pisar un builtin aunque sanitizeCustomProfile lo acepte
				if (builtinIds.has(profile.id)) continue;

				result.push(profile);
			}

			return result;
		} catch {
			return [];
		}
	}

	get profiles(): AgentProfile[] {
		return [...AGENT_PROFILES, ...this.customProfiles];
	}

	applyPermissions(profile: AgentProfile | null): void {
		const nextAllowed = new Set(profile ? this.getPreApprovedKeys(profile) : []);
		const toRevoke = [...this.grantedKeys].filter((key) => !nextAllowed.has(key));

		if (toRevoke.length) {
			permissionsStore.revokeTools(toRevoke);
			for (const key of toRevoke) this.grantedKeys.delete(key);
		}

		for (const key of nextAllowed) {
			if (!permissionsStore.hasTool(key)) this.grantedKeys.add(key);
		}

		if (nextAllowed.size) permissionsStore.allowTools([...nextAllowed]);
	}

	buildToolPolicy(profile: AgentProfile): AgentToolPolicy {
		const allowed = new Set(profile.allowedTools);
		const entries = toolsStore.allTools;
		const disabledTools = entries
			.filter((entry) => !allowed.has(entry.definition.function.name))
			.map((entry) => entry.key);
		const disabledToolCategories = Object.values(ToolSource).filter((source) => {
			const ofSource = entries.filter((entry) => entry.source === source);

			return (
				ofSource.length > 0 &&
				ofSource.every((entry) => !allowed.has(entry.definition.function.name))
			);
		});

		return {
			disabledToolCategories: disabledToolCategories.length ? disabledToolCategories : undefined,
			disabledTools: disabledTools.length ? disabledTools : undefined
		};
	}

	get(id: AgentProfileId | null | undefined): AgentProfile | null {
		if (!id) return null;

		return this.profiles.find((profile) => profile.id === id) ?? null;
	}

	saveCustomProfiles(profiles: AgentProfile[]): void {
		const builtinIds = new Set(AGENT_PROFILES.map((p) => p.id));
		const valid = profiles
			.filter((p) => !builtinIds.has(p.id))
			.map((p) => {
				const entry: Record<string, unknown> = {
					allowedTools: [...new Set(p.allowedTools.filter((t) => typeof t === 'string' && t.trim()))],
					description: p.description?.trim() ?? '',
					id: p.id.trim(),
					label: p.label.trim(),
					systemPrompt: p.systemPrompt.trim()
				};

				if (p.icon) entry.icon = p.icon;
				if (p.color) entry.color = p.color;

				return entry;
			})
			.filter((p) => p.id && p.label && p.systemPrompt);

		settingsStore.updateConfig(
			SETTINGS_KEYS.AGENT_PROFILES_CUSTOM,
			JSON.stringify(valid)
		);
	}

	/** JSON de un único perfil personalizado, listo para compartir */
	exportCustomProfile(id: string): string {
		const profile = this.customProfiles.find((p) => p.id === id);

		if (!profile) {
			throw new Error(`Perfil personalizado no encontrado: ${id}`);
		}

		const shareable = { ...profile } as Partial<AgentProfile>;

		delete shareable.isCustom;

		return JSON.stringify(shareable, null, 2);
	}

	/** Valida e importa un perfil desde JSON (objeto único, no array) */
	importCustomProfile(json: string): AgentProfile {
		let parsed: unknown;

		try {
			parsed = JSON.parse(json);
		} catch {
			throw new Error('El JSON no es valido');
		}

		if (Array.isArray(parsed)) {
			throw new Error('Se esperaba un unico objeto de perfil, no un array');
		}

		const profile = sanitizeCustomProfile(parsed);

		if (!profile) {
			throw new Error(
				'Perfil invalido: id reservado/ausente, label o systemPrompt ausentes o tipos incorrectos'
			);
		}

		this.upsertCustomProfile(profile);

		return profile;
	}

	upsertCustomProfile(profile: AgentProfile): void {
		const id = profile.id.trim();
		const builtinIds = new Set(AGENT_PROFILES.map((p) => p.id));

		if (!id || builtinIds.has(id as AgentProfileId)) {
			throw new Error('Identificador de perfil no valido o reservado');
		}

		if (!profile.label.trim()) {
			throw new Error('El perfil debe tener un nombre');
		}

		if (!profile.systemPrompt.trim()) {
			throw new Error('El perfil debe tener un system prompt');
		}

		const current = this.customProfiles;
		const next = current.filter((p) => p.id !== id);
		const icon = sanitizeIcon(profile.icon);
		const color = sanitizeColor(profile.color);
		const entry: AgentProfile = {
			allowedTools: [...new Set(profile.allowedTools.filter((t) => typeof t === 'string' && t.trim()))],
			description: profile.description?.trim() ?? '',
			id: id as AgentProfileId,
			isCustom: true,
			label: profile.label.trim(),
			systemPrompt: profile.systemPrompt.trim()
		};

		if (icon) entry.icon = icon;
		if (color) entry.color = color;

		next.push(entry);

		this.saveCustomProfiles(next);
	}

	deleteCustomProfile(id: string): void {
		const next = this.customProfiles.filter((p) => p.id !== id);

		this.saveCustomProfiles(next);
	}

	getPreApprovedKeys(profile: AgentProfile): string[] {
		return profile.allowedTools
			.filter((name) => PRE_APPROVED_TOOLS.has(name))
			.map((name) => toolsStore.getPermissionKey(name))
			.filter((key): key is string => key !== null);
	}

	resetPending(): void {
		this.pendingProfileId = null;
	}
}

export const agentProfilesStore = new AgentProfilesStore();
