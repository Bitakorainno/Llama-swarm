<script lang="ts">
	import { ListChecks, Network, SearchCode, Terminal } from '@lucide/svelte';
	import { Logo } from '$lib/components/app';
	import { CHAT_GREETING_ENTER_DELAY_MS } from '$lib/constants';
	import { chatStore, draftRequestStore, serverStore } from '$lib/stores';
	import type { AgentProfileId } from '$lib/types';

	interface Props {
		isEmpty: boolean;
	}

	let { isEmpty = false }: Props = $props();

	let hasEntered = $state(false);

	// Starts the entry only once the greeting has been painted hidden, so it
	// plays on a refresh or a first visit too, when the first frames are busy
	// loading the app, not just after the form moves.
	$effect(() => {
		if (!isEmpty) {
			hasEntered = false;

			return;
		}

		let frame = requestAnimationFrame(() => {
			frame = requestAnimationFrame(() => (hasEntered = true));
		});

		return () => cancelAnimationFrame(frame);
	});

	let enterClass = $derived([
		'transition-opacity duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]',
		!hasEntered && 'opacity-0'
	]);

	const QUICK_ACTIONS: Array<{
		icon: typeof Terminal;
		label: string;
		caption: string;
		profile: AgentProfileId | null;
		prompt: string;
	}> = [
		{
			caption: 'developer',
			icon: Terminal,
			label: 'Implement',
			profile: 'developer',
			prompt: 'Implement the task and verify that the build passes.'
		},
		{
			caption: 'planner',
			icon: ListChecks,
			label: 'Plan first',
			profile: 'planner',
			prompt: 'Lay out a plan for this change. Do not modify any files yet.'
		},
		{
			caption: 'orchestrator',
			icon: Network,
			label: 'Delegate',
			profile: 'orchestrator',
			prompt: 'Decompose this goal and delegate the subtasks.'
		},
		{
			caption: 'read-only',
			icon: SearchCode,
			label: 'Explore',
			profile: null,
			prompt: 'Explain this repository: architecture, entry points and how to run it.'
		}
	];

	async function runQuickAction(action: (typeof QUICK_ACTIONS)[number]) {
		try {
			await chatStore.applyAgentProfile(action.profile);
			draftRequestStore.request(action.prompt);
		} catch (error) {
			console.error('[ChatScreenGreeting] quick action failed:', error);
		}
	}
</script>

<div
	class={[
		'pointer-events-none mb-4 hidden px-4 text-center text-balance',
		isEmpty && 'mb-[calc(50dvh-8rem)] md:mb-8 pointer-events-auto block!',
		// out of the page flow on desktop, just above the form: inside the form
		// wrapper's top padding, so showing it never changes the wrapper's height
		isEmpty && 'md:absolute md:inset-x-0 md:bottom-[calc(100%-var(--chat-form-padding-top))]'
	]}
>
	<div style:transition-delay="{CHAT_GREETING_ENTER_DELAY_MS}ms" class={enterClass}>
		<div class="mb-4 flex flex-col items-center gap-2.5">
			<div
				class="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[oklch(0.58_0.17_32)] shadow-[0_0_44px_-12px_oklch(0.79_0.155_70/0.55)] ring-1 ring-primary/50"
			>
				<Logo class="h-7 w-7 text-primary-foreground [&_svg]:fill-current" />
			</div>

			<div class="font-mono text-[9px] font-medium uppercase tracking-[0.3em] text-primary/85">
				llama-swarm · local studio
			</div>
		</div>

		<h1
			class="mb-1 text-balance bg-gradient-to-b from-foreground via-foreground to-foreground/45 bg-clip-text text-2xl font-semibold tracking-tight text-transparent md:text-4xl md:leading-[1.05]"
		>
			What shall we build?
		</h1>

		<p class="mx-auto max-w-md text-muted-foreground md:text-base">
			Type a message, attach files or start from a quick action — the studio is ready when you are.
		</p>

		<div class="mx-auto mt-4 flex max-w-sm flex-wrap items-stretch justify-center gap-1.5">
			{#each QUICK_ACTIONS as action (action.caption)}
				{@const Icon = action.icon}
				<button
					class="group flex min-w-0 flex-1 basis-36 flex-col items-start gap-1 rounded-xl border border-border/70 bg-card/70 px-2.5 py-1.5 text-left shadow-xs backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card hover:shadow-md"
					onclick={() => runQuickAction(action)}
					type="button"
				>
					<div class="flex w-full items-center justify-between gap-2">
						<Icon class="size-3.5 text-primary" />

						<span class="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/80">
							{action.caption}
						</span>
					</div>

					<span class="text-[13px] font-medium text-foreground">{action.label}</span>
				</button>
			{/each}
		</div>

		<div class="mt-5 font-mono text-[10px] text-muted-foreground/60">
			<kbd class="rounded border border-border/60 bg-muted/60 px-1 py-0.5">Ctrl</kbd>
			+
			<kbd class="rounded border border-border/60 bg-muted/60 px-1 py-0.5">K</kbd> search
			<span class="mx-2 text-border">·</span>

			<kbd class="rounded border border-border/60 bg-muted/60 px-1 py-0.5">Ctrl</kbd>, settings
			{#if serverStore.props?.modalities?.audio}
				<span class="mx-2 text-border">·</span> or record audio
			{/if}
		</div>
	</div>
</div>
