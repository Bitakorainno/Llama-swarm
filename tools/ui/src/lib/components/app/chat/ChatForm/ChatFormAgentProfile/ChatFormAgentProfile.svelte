<script lang="ts">
	import { Check, Sparkles } from '@lucide/svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { AGENT_PROFILES } from '$lib/constants';
	import { agentProfilesStore, chatStore, conversationsStore } from '$lib/stores';
	import type { AgentProfileId } from '$lib/types';

	interface Props {
		disabled?: boolean;
	}

	let { disabled = false }: Props = $props();

	let applying = $state(false);

	const activeId = $derived(
		conversationsStore.activeConversation?.agentProfileId ?? agentProfilesStore.pendingProfileId
	);
	const active = $derived(agentProfilesStore.get(activeId));

	async function select(id: AgentProfileId | null) {
		if (applying) return;

		applying = true;

		try {
			await chatStore.applyAgentProfile(id);
		} catch (err) {
			console.error('[ChatFormAgentProfile] failed to apply profile:', err);
		} finally {
			applying = false;
		}
	}
</script>

<div class="justify-self-start">
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<button
					{...props}
					class="flex min-w-0 w-auto items-center gap-1 rounded-md px-2 py-1 text-xs backdrop-blur-2xl {active
						? 'text-foreground'
						: 'text-muted-foreground'}"
					{disabled}
					type="button"
				>
					<Sparkles class="w-3.5 h-3.5" />

					<span class="max-w-64 truncate">{active?.label ?? 'Modo'}</span>
				</button>
			{/snippet}
		</DropdownMenu.Trigger>

		<DropdownMenu.Content align="start" class="w-72" side="top">
			{#each AGENT_PROFILES as profile (profile.id)}
				<DropdownMenu.Item
					class="flex cursor-pointer items-start gap-2"
					onclick={() => select(profile.id)}
				>
					<div class="flex min-w-0 flex-col">
						<span class="text-sm font-medium">{profile.label}</span>

						<span class="text-xs text-muted-foreground">{profile.description}</span>
					</div>

					{#if activeId === profile.id}
						<Check class="ml-auto size-4 shrink-0" />
					{/if}
				</DropdownMenu.Item>
			{/each}

			<DropdownMenu.Separator />

			<DropdownMenu.Item
				class="flex cursor-pointer items-center gap-2"
				onclick={() => select(null)}
			>
				<span class="text-sm">Sin modo</span>

				{#if !activeId}
					<Check class="ml-auto size-4 shrink-0" />
				{/if}
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</div>
