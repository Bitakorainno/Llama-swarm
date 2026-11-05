<script lang="ts">
	import {
		Check,
		ChevronDown,
		ClipboardPaste,
		Copy,
		Download,
		Edit2,
		Plus,
		Trash2,
		X
	} from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import {
		AGENT_PROFILE_COLORS,
		AGENT_PROFILE_ICONS,
		AGENT_PROFILE_TEMPLATES,
		agentProfileColor,
		agentProfileIcon
	} from '$lib/constants';
	import { agentProfilesStore } from '$lib/stores/agent-profiles.svelte';
	import { toolsStore } from '$lib/stores/tools.svelte';
	import { copyToClipboard } from '$lib/utils';
	import type { AgentProfile } from '$lib/types';

	let id = $state('');
	let label = $state('');
	let description = $state('');
	let systemPrompt = $state('');
	let icon = $state<string>('sparkles');
	let color = $state<string>('default');
	let selectedTools = $state<string[]>([
		'read_file',
		'file_glob_search',
		'grep_search',
		'get_info'
	]);
	let customToolInput = $state('');
	let isEditing = $state(false);
	let editingId = $state('');
	let error = $state<string | null>(null);
	let importOpen = $state(false);
	let importText = $state('');
	let importFeedback = $state<string | null>(null);

	const defaultToolOptions = [
		'read_file',
		'file_glob_search',
		'grep_search',
		'get_info',
		'write_file',
		'edit_file',
		'exec_shell_command',
		'agents_spawn_agent',
		'agents_spawn_agents',
		'agents_list_agents'
	];

	const availableTools = $derived.by(() => {
		const names = new Set<string>(defaultToolOptions);

		for (const entry of toolsStore.allTools) {
			const toolName = entry.definition?.function?.name;

			if (toolName) names.add(toolName);
		}

		return Array.from(names);
	});

	function resetForm() {
		id = '';
		label = '';
		description = '';
		systemPrompt = '';
		icon = 'sparkles';
		color = 'default';
		selectedTools = ['read_file', 'file_glob_search', 'grep_search', 'get_info'];
		customToolInput = '';
		isEditing = false;
		editingId = '';
		error = null;
	}

	function handleEdit(profile: AgentProfile) {
		id = profile.id;
		label = profile.label;
		description = profile.description ?? '';
		systemPrompt = profile.systemPrompt;
		icon = profile.icon ?? 'sparkles';
		color = profile.color ?? 'default';
		selectedTools = [...profile.allowedTools];
		isEditing = true;
		editingId = profile.id;
		error = null;
	}

	function toggleTool(toolName: string) {
		if (selectedTools.includes(toolName)) {
			selectedTools = selectedTools.filter((t) => t !== toolName);
		} else {
			selectedTools = [...selectedTools, toolName];
		}
	}

	function addCustomTool() {
		const tool = customToolInput.trim();

		if (!tool) return;

		if (!selectedTools.includes(tool)) {
			selectedTools = [...selectedTools, tool];
		}

		customToolInput = '';
	}

	function applyTemplate(template: (typeof AGENT_PROFILE_TEMPLATES)[number]) {
		id = template.id;
		label = template.label;
		description = template.description;
		systemPrompt = template.systemPrompt;
		icon = template.icon;
		color = template.color;
		selectedTools = [...template.allowedTools];
		isEditing = false;
		editingId = '';
		error = null;
	}

	function handleSave() {
		error = null;

		try {
			agentProfilesStore.upsertCustomProfile({
				allowedTools: selectedTools,
				color,
				description,
				icon,
				id: isEditing ? editingId : id,
				label,
				systemPrompt
			});
			resetForm();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Error al guardar perfil';
		}
	}

	function handleDelete(profileId: string) {
		if (isEditing && editingId === profileId) {
			resetForm();
		}

		agentProfilesStore.deleteCustomProfile(profileId);
	}

	async function handleCopyProfile(profile: AgentProfile) {
		try {
			const json = agentProfilesStore.exportCustomProfile(profile.id);

			await copyToClipboard(json, `"${profile.label}" copiado al portapapeles`);
		} catch (err) {
			error = err instanceof Error ? err.message : 'No se pudo copiar el perfil';
		}
	}

	function handleImport() {
		importFeedback = null;

		try {
			const profile = agentProfilesStore.importCustomProfile(importText);

			importFeedback = `Perfil "${profile.label}" importado`;
			importText = '';
			importOpen = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'No se pudo importar el perfil';
		}
	}

	async function handlePasteFromClipboard() {
		importFeedback = null;

		try {
			const text = await navigator.clipboard.readText();

			if (text.trim()) {
				importText = text;
			} else {
				error = 'El portapapeles esta vacio';
			}
		} catch {
			error = 'No se pudo leer el portapapeles; pega el JSON manualmente';
		}
	}
</script>

<div class="space-y-4 rounded-lg border border-border/60 p-4">
	<div class="flex items-start justify-between gap-3">
		<div>
			<h4 class="text-sm font-semibold">Perfiles de agente personalizados</h4>
			<p class="text-xs text-muted-foreground">
				Crea y edita perfiles con sus herramientas y prompt dedicados. Los modos integrados están
				protegidos.
			</p>
		</div>

		<Button
			aria-label="Importar perfil"
			class="h-7 shrink-0 gap-1 px-2 text-[11px]"
			onclick={() => (importOpen = !importOpen)}
			size="sm"
			variant="outline"
		>
			<Download class="size-3.5" />
			Importar
			<ChevronDown class="size-3 transition-transform {importOpen ? 'rotate-180' : ''}" />
		</Button>
	</div>

	{#if importOpen}
		<div class="space-y-2 rounded-md border border-border/50 bg-muted/20 p-2.5">
			<Label class="text-xs" for="import-profile-json">JSON del perfil</Label>
			<Textarea
				bind:value={importText}
				class="min-h-24 font-mono text-[11px]"
				id="import-profile-json"
				placeholder={'{"id": "auditor", "label": "Auditor", "allowedTools": ["read_file"], ...}'}
			/>
			<div class="flex flex-wrap items-center gap-2">
				<Button
					class="h-7 gap-1 text-xs"
					onclick={handlePasteFromClipboard}
					type="button"
					variant="outline"
				>
					<ClipboardPaste class="size-3.5" />
					Pegar del portapapeles
				</Button>
				<Button
					class="h-7 gap-1 text-xs"
					disabled={!importText.trim()}
					onclick={handleImport}
					type="button"
					variant="secondary"
				>
					<Check class="size-3.5" />
					Importar perfil
				</Button>
			</div>
			{#if importFeedback}
				<p class="text-[11px] text-green-600 dark:text-green-400">{importFeedback}</p>
			{/if}
		</div>
	{/if}

	<div class="space-y-3">
		{#if agentProfilesStore.customProfiles.length === 0}
			<p class="text-xs text-muted-foreground italic">No hay perfiles personalizados todavía.</p>
		{:else}
			<div class="space-y-2">
				{#each agentProfilesStore.customProfiles as profile (profile.id)}
					{@const ProfileIcon = agentProfileIcon(profile.icon)}
					{@const palette = agentProfileColor(profile.color)}
					<div
						class="flex items-start justify-between gap-3 rounded-md border border-border/40 p-2.5 text-xs {editingId ===
						profile.id
							? 'border-primary/60 bg-muted/20'
							: ''}"
					>
						<div class="min-w-0 space-y-1">
							<div class="flex items-center gap-2">
								<ProfileIcon class="size-3.5 shrink-0 {palette.textClass}" />
								<span class="font-medium text-foreground">{profile.label}</span>
								<code class="rounded bg-muted px-1 text-[10px] text-muted-foreground"
									>{profile.id}</code
								>
								{#if editingId === profile.id}
									<span class="rounded bg-primary/20 px-1 py-0.5 text-[10px] text-primary"
										>Editando</span
									>
								{/if}
							</div>
							{#if profile.description}
								<p class="text-muted-foreground">{profile.description}</p>
							{/if}
							<p class="text-[11px] text-muted-foreground">
								Herramientas: {profile.allowedTools.length
									? profile.allowedTools.join(', ')
									: '(ninguna)'}
							</p>
						</div>

						<div class="flex items-center gap-1">
							<Button
								aria-label={`Copiar ${profile.label} como JSON`}
								class="h-7 w-7 text-muted-foreground hover:text-foreground"
								onclick={() => handleCopyProfile(profile)}
								size="icon"
								variant="ghost"
							>
								<Copy class="size-3.5" />
							</Button>

							<Button
								aria-label={`Editar ${profile.label}`}
								class="h-7 w-7 text-muted-foreground hover:text-foreground"
								onclick={() => handleEdit(profile)}
								size="icon"
								variant="ghost"
							>
								<Edit2 class="size-3.5" />
							</Button>

							<Button
								aria-label={`Eliminar ${profile.label}`}
								class="h-7 w-7 text-destructive hover:text-destructive"
								onclick={() => handleDelete(profile.id)}
								size="icon"
								variant="ghost"
							>
								<Trash2 class="size-3.5" />
							</Button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div class="space-y-3 border-t border-border/40 pt-3">
		<div class="flex items-center justify-between">
			<h5 class="text-xs font-medium">
				{isEditing ? `Editar perfil (${editingId})` : 'Nuevo perfil'}
			</h5>

			{#if isEditing}
				<Button class="h-6 gap-1 px-2 text-[11px]" onclick={resetForm} variant="ghost">
					<X class="size-3" />
					Cancelar edición
				</Button>
			{/if}
		</div>

		{#if !isEditing}
			<div class="space-y-1.5">
				<Label class="text-xs text-muted-foreground">Plantillas rápidas</Label>
				<div class="flex flex-wrap gap-1.5">
					{#each AGENT_PROFILE_TEMPLATES as template (template.id)}
						<button
							class="rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
							onclick={() => applyTemplate(template)}
							type="button"
						>
							{template.label}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		{#if error}
			<p class="text-xs text-destructive">{error}</p>
		{/if}

		<div class="grid grid-cols-1 gap-2 md:grid-cols-2">
			<div class="space-y-1">
				<Label class="text-xs" for="custom-profile-id">ID</Label>
				<Input
					bind:value={id}
					class="h-8 text-xs"
					disabled={isEditing}
					id="custom-profile-id"
					placeholder="auditor"
				/>
			</div>

			<div class="space-y-1">
				<Label class="text-xs" for="custom-profile-label">Nombre visible</Label>
				<Input
					bind:value={label}
					class="h-8 text-xs"
					id="custom-profile-label"
					placeholder="Auditor de seguridad"
				/>
			</div>
		</div>

		<div class="space-y-1">
			<Label class="text-xs" for="custom-profile-description">Descripción</Label>
			<Input
				bind:value={description}
				class="h-8 text-xs"
				id="custom-profile-description"
				placeholder="Revisa vulnerabilidades y riesgos"
			/>
		</div>

		<div class="grid grid-cols-1 gap-2 md:grid-cols-2">
			<div class="space-y-1.5">
				<Label class="text-xs">Icono</Label>
				<div class="flex flex-wrap gap-1">
					{#each AGENT_PROFILE_ICONS as entry (entry.id)}
						{@const IconComponent = entry.icon}
						{@const selected = icon === entry.id}
						<button
							aria-label={entry.label}
							aria-pressed={selected}
							class="flex size-7 items-center justify-center rounded-md border transition-colors {selected
								? 'border-primary bg-primary/10 text-primary'
								: 'border-border/60 bg-background text-muted-foreground hover:bg-muted/30'}"
							onclick={() => (icon = entry.id)}
							title={entry.label}
							type="button"
						>
							<IconComponent class="size-3.5" />
						</button>
					{/each}
				</div>
			</div>

			<div class="space-y-1.5">
				<Label class="text-xs">Color</Label>
				<div class="flex flex-wrap gap-1.5">
					{#each AGENT_PROFILE_COLORS as entry (entry.id)}
						{@const selected = color === entry.id}
						<button
							aria-label={entry.label}
							aria-pressed={selected}
							class="flex size-6 items-center justify-center rounded-full border transition-transform {selected
								? 'scale-110 border-primary'
								: 'border-border/60'}"
							onclick={() => (color = entry.id)}
							title={entry.label}
							type="button"
						>
							<span class="size-3.5 rounded-full {entry.dotClass}"></span>
						</button>
					{/each}
				</div>
			</div>
		</div>

		<div class="space-y-2">
			<Label class="text-xs">Herramientas permitidas (selector visual)</Label>

			<div class="flex flex-wrap gap-1.5">
				{#each availableTools as tool (tool)}
					{@const selected = selectedTools.includes(tool)}
					<button
						class="flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors {selected
							? 'border-primary bg-primary/10 text-primary font-medium'
							: 'border-border/60 bg-background text-muted-foreground hover:bg-muted/30'}"
						onclick={() => toggleTool(tool)}
						type="button"
					>
						{#if selected}
							<Check class="size-3" />
						{/if}
						<span>{tool}</span>
					</button>
				{/each}
			</div>

			<div class="flex items-center gap-2 pt-1">
				<Input
					bind:value={customToolInput}
					class="h-7 text-xs"
					placeholder="Otra herramienta (ej. mi_mcp_tool)"
				/>
				<Button class="h-7 text-xs" onclick={addCustomTool} type="button" variant="outline">
					Añadir
				</Button>
			</div>
		</div>

		<div class="space-y-1">
			<Label class="text-xs" for="custom-profile-prompt">System prompt</Label>
			<Textarea
				bind:value={systemPrompt}
				class="min-h-20 text-xs"
				id="custom-profile-prompt"
				placeholder="# MODO AUDITOR&#10;&#10;Eres un auditor..."
			/>
		</div>

		<div class="flex justify-end gap-2">
			<Button class="h-8 gap-1 text-xs" onclick={handleSave} type="button" variant="secondary">
				<Plus class="size-3.5" />
				{isEditing ? 'Actualizar perfil' : 'Guardar perfil'}
			</Button>
		</div>
	</div>
</div>
