import {
	AGENT_PROFILE_COLOR_IDS,
	AGENT_PROFILE_ICON_IDS,
	AGENT_PROFILE_TEMPLATES,
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
		expect(orchestrator?.allowedTools).toContain('agents_spawn_agents');
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

	it('exposes prompt templates with valid tools, icons and colors', () => {
		expect(AGENT_PROFILE_TEMPLATES.length).toBeGreaterThan(0);

		for (const template of AGENT_PROFILE_TEMPLATES) {
			expect(template.allowedTools.length).toBeGreaterThan(0);
			expect(template.systemPrompt.startsWith(PROFILE_PROMPT_MARKER)).toBe(true);
			expect(template.label.trim()).toBeTruthy();
			expect(AGENT_PROFILE_ICON_IDS.has(template.icon)).toBe(true);
			expect(AGENT_PROFILE_COLOR_IDS.has(template.color)).toBe(true);
		}

		expect(AGENT_PROFILE_ICON_IDS.size).toBeGreaterThan(0);
		expect(AGENT_PROFILE_COLOR_IDS.size).toBeGreaterThan(0);
	});

	it('round-trips icon and color through upsert and storage', () => {
		const key = SETTINGS_KEYS.AGENT_PROFILES_CUSTOM;
		const original = settingsStore.config[key];

		try {
			agentProfilesStore.upsertCustomProfile({
				allowedTools: ['read_file'],
				color: 'teal',
				description: 'Round trip',
				icon: 'network',
				id: 'round-trip',
				label: 'Round Trip',
				systemPrompt: '# MODO ROUND TRIP'
			});

			const stored = settingsStore.config[key];
			const parsed = JSON.parse(String(stored)) as Array<Record<string, unknown>>;
			const saved = parsed.find((p) => p.id === 'round-trip');

			expect(saved?.icon).toBe('network');
			expect(saved?.color).toBe('teal');

			const profile = agentProfilesStore.get('round-trip');

			expect(profile?.icon).toBe('network');
			expect(profile?.color).toBe('teal');

			agentProfilesStore.deleteCustomProfile('round-trip');
		} finally {
			settingsStore.config[key] = original;
		}
	});

	it('drops unknown icon and color but keeps the profile', () => {
		const key = SETTINGS_KEYS.AGENT_PROFILES_CUSTOM;
		const original = settingsStore.config[key];

		try {
			settingsStore.config[key] = JSON.stringify([
				{
					allowedTools: ['read_file'],
					color: 'no-such-color',
					icon: 'no-such-icon',
					id: 'invalid-appearance',
					label: 'Invalid Appearance',
					systemPrompt: '# MODO X'
				}
			]);

			const profile = agentProfilesStore.get('invalid-appearance');

			expect(profile).not.toBeNull();
			expect(profile?.icon).toBeUndefined();
			expect(profile?.color).toBeUndefined();

			agentProfilesStore.deleteCustomProfile('invalid-appearance');
		} finally {
			settingsStore.config[key] = original;
		}
	});

	it('exports and re-imports a single profile without builtins or isCustom', () => {
		const key = SETTINGS_KEYS.AGENT_PROFILES_CUSTOM;
		const original = settingsStore.config[key];

		try {
			agentProfilesStore.upsertCustomProfile({
				allowedTools: ['grep_search'],
				color: 'red',
				description: 'Share me',
				icon: 'bug',
				id: 'shareable',
				label: 'Shareable',
				systemPrompt: '# MODO SHARE'
			});

			const json = agentProfilesStore.exportCustomProfile('shareable');
			const parsed = JSON.parse(json) as Record<string, unknown>;

			expect(parsed.label).toBe('Shareable');
			expect(parsed.icon).toBe('bug');
			expect(parsed.isCustom).toBeUndefined();

			parsed.id = 'shareable-copy';
			const imported = agentProfilesStore.importCustomProfile(JSON.stringify(parsed));

			expect(imported.id).toBe('shareable-copy');
			expect(agentProfilesStore.get('shareable-copy')).not.toBeNull();

			expect(() => agentProfilesStore.importCustomProfile('{ not json')).toThrow('JSON');
			expect(() => agentProfilesStore.importCustomProfile(JSON.stringify([parsed]))).toThrow(
				'array'
			);

			parsed.id = 'developer';

			expect(() => agentProfilesStore.importCustomProfile(JSON.stringify(parsed))).toThrow();

			agentProfilesStore.deleteCustomProfile('shareable');
			agentProfilesStore.deleteCustomProfile('shareable-copy');
		} finally {
			settingsStore.config[key] = original;
		}
	});

	it('loads and validates custom profiles from settings without overwriting builtins', () => {
		const key = SETTINGS_KEYS.AGENT_PROFILES_CUSTOM;
		const original = settingsStore.config[key];

		try {
			settingsStore.config[key] = JSON.stringify([
				{
					allowedTools: ['read_file'],
					description: 'Perfil de prueba',
					id: 'custom-tester',
					label: 'Custom Tester',
					systemPrompt: '# MODO TESTER\nPrueba'
				},
				{
					allowedTools: ['write_file'],
					description: 'Intento de pisar builtin',
					id: 'developer',
					label: 'Fake Dev',
					systemPrompt: 'pisa'
				},
				{
					id: '',
					label: 'Invalido'
				}
			]);

			const custom = agentProfilesStore.get('custom-tester');

			expect(custom).not.toBeNull();
			expect(custom?.isCustom).toBe(true);
			expect(custom?.label).toBe('Custom Tester');
			expect(custom?.allowedTools).toEqual(['read_file']);

			const dev = agentProfilesStore.get('developer');

			expect(dev?.label).toBe('Desarrollador');
			expect(dev?.isCustom).toBeUndefined();
			expect(agentProfilesStore.profiles.some((p) => p.id === 'custom-tester')).toBe(true);

			agentProfilesStore.upsertCustomProfile({
				allowedTools: ['grep_search'],
				description: 'Auditor',
				id: 'auditor',
				label: 'Auditor',
				systemPrompt: '# MODO AUDITOR'
			});

			expect(agentProfilesStore.get('auditor')?.label).toBe('Auditor');

			expect(() => {
				agentProfilesStore.upsertCustomProfile({
					allowedTools: [],
					description: '',
					id: 'developer',
					label: 'Override',
					systemPrompt: 'prompt'
				});
			}).toThrow('reservado');

			agentProfilesStore.deleteCustomProfile('auditor');
			expect(agentProfilesStore.get('auditor')).toBeNull();

			// Verifica actualizacion en caliente (upsert existente)
			agentProfilesStore.upsertCustomProfile({
				allowedTools: ['read_file', 'grep_search'],
				description: 'Custom actualizado',
				id: 'custom-tester',
				label: 'Custom Tester V2',
				systemPrompt: '# MODO TESTER V2'
			});

			const updated = agentProfilesStore.get('custom-tester');

			expect(updated?.label).toBe('Custom Tester V2');
			expect(updated?.description).toBe('Custom actualizado');
			expect(updated?.allowedTools).toContain('grep_search');

			// Sanitizacion al importar settings invalidos
			settingsStore.importSettings({
				config: {
					[SETTINGS_KEYS.AGENT_PROFILES_CUSTOM]: '{invalid-json'
				} as unknown as typeof settingsStore.config,
				timestamp: Date.now(),
				userOverrides: [],
				version: 1
			});

			expect(settingsStore.config[SETTINGS_KEYS.AGENT_PROFILES_CUSTOM]).toBe('[]');
		} finally {
			settingsStore.config[key] = original;
		}
	});
});
