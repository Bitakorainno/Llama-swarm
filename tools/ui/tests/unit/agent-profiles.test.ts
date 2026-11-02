import {
	AGENT_PROFILES,
	PROFILE_PROMPT_MARKER,
	READ_ONLY_TOOLS,
	SETTINGS_KEYS
} from '$lib/constants';
import { agentProfilesStore } from '$lib/stores/agent-profiles.svelte';
import { settingsStore } from '$lib/stores/settings/index.svelte';
import { describe, expect, it } from 'vitest';

const ALLOWED_WRITE_TOOLS = ['write_file', 'edit_file', 'exec_shell_command'];

describe('agent profiles', () => {
	it('declares unique ids with a labelled prompt', () => {
		const ids = AGENT_PROFILES.map((profile) => profile.id);

		expect(new Set(ids).size).toBe(ids.length);
		for (const profile of AGENT_PROFILES) {
			expect(profile.systemPrompt.startsWith(PROFILE_PROMPT_MARKER)).toBe(true);
			expect(profile.allowedTools.length).toBeGreaterThan(0);
		}
	});

	it('keeps the planner read-only', () => {
		const planner = agentProfilesStore.get('planner');

		expect(planner).not.toBeNull();
		for (const tool of planner?.allowedTools ?? []) expect(READ_ONLY_TOOLS).toContain(tool);
		for (const tool of ALLOWED_WRITE_TOOLS) expect(planner?.allowedTools).not.toContain(tool);
	});

	it('gives the developer write access but no delegation', () => {
		const developer = agentProfilesStore.get('developer');

		expect(developer?.allowedTools).toContain('exec_shell_command');
		expect(developer?.allowedTools).not.toContain('agents_spawn_agent');
	});

	it('gives the orchestrator delegation without write access', () => {
		const orchestrator = agentProfilesStore.get('orchestrator');

		expect(orchestrator?.allowedTools).toContain('agents_spawn_agent');
		for (const tool of ALLOWED_WRITE_TOOLS) expect(orchestrator?.allowedTools).not.toContain(tool);
	});

	it('returns null for an unknown id', () => {
		expect(agentProfilesStore.get(null)).toBeNull();
	});

	it('resolves the workspace from settings, trimming blanks', () => {
		const key = SETTINGS_KEYS.AGENTIC_WORKSPACE;
		const original = settingsStore.config[key];

		try {
			settingsStore.config[key] = '  C:\\projects  ';
			expect(agentProfilesStore.defaultWorkspace).toBe('C:\\projects');

			settingsStore.config[key] = '   ';
			expect(agentProfilesStore.defaultWorkspace).toBeUndefined();

			settingsStore.config[key] = undefined;
			expect(agentProfilesStore.defaultWorkspace).toBeUndefined();
		} finally {
			settingsStore.config[key] = original;
		}
	});
});
