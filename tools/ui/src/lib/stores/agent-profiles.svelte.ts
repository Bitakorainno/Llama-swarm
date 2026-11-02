import { AGENT_PROFILES, READ_ONLY_TOOLS, SETTINGS_KEYS } from '$lib/constants';
import { ToolSource } from '$lib/enums';
import { settingsStore } from '$lib/stores/settings/index.svelte';
import { toolsStore } from '$lib/stores/tools.svelte';
import type { AgentProfile, AgentProfileId } from '$lib/types';

export interface AgentToolPolicy {
	disabledToolCategories?: ToolSource[];
	disabledTools?: string[];
}

const PRE_APPROVED_TOOLS = new Set([...READ_ONLY_TOOLS, 'agents_spawn_agent']);

class AgentProfilesStore {
	pendingProfileId = $state<AgentProfileId | null>(null);

	get defaultWorkspace(): string | undefined {
		const value = settingsStore.config[SETTINGS_KEYS.AGENTIC_WORKSPACE];

		if (typeof value !== 'string') return undefined;

		const trimmed = value.trim();

		return trimmed || undefined;
	}

	get profiles(): AgentProfile[] {
		return AGENT_PROFILES;
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

		return AGENT_PROFILES.find((profile) => profile.id === id) ?? null;
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
