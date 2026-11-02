<script lang="ts">
	import ChatFormCurrentWorkingDirectoryChip from './ChatFormCurrentWorkingDirectoryChip.svelte';
	import ChatFormCurrentWorkingDirectoryResultsList from './ChatFormCurrentWorkingDirectoryResultsList.svelte';
	import SearchInput from '$lib/components/app/forms/SearchInput.svelte';
	import * as Popover from '$lib/components/ui/popover';
	import { DEFAULT_MOBILE_BREAKPOINT, HOME_TILDE, SEARCH, UI_DATA_ATTRS } from '$lib/constants';
	import { BuiltInTool, GlobSearchType, KeyboardKey, ToolSource } from '$lib/enums';
	import { useDebouncedSearch } from '$lib/hooks/use-debounced-search.svelte';
	import { usePickerNavigation } from '$lib/hooks/use-picker-navigation.svelte';
	import { useScrollActiveRow } from '$lib/hooks/use-scroll-active-row.svelte';
	import { conversationsStore, toolsStore } from '$lib/stores';
	import { abbreviateHome, runGlobSearchWithChildren } from '$lib/utils';

	const ROOT_PATH_REGEX = /^(?:[A-Za-z]:[\\/]?|\/|\\\\[^\\/]+[\\/][^\\/]+[\\/]?)$/;

	// Microtask delay so the popover's focus scope tears down first.
	const FOCUS_DELAY_MS = 0;

	interface Props {
		class?: string;
		disabled?: boolean;
		directory?: string | null;
		/** Controlled open state; the host owns it so the chip click and the
		 * `/cwd` slash command open the picker through the same path. */
		isOpen: boolean;
		/** Two-way bound query, kept in sync with the text after `/cwd `. */
		query: string;
		/** Anchor at the form's top edge so the popover floats above the box. */
		customAnchor?: HTMLElement | null;
		onChange?: (directory: string | null) => void;
		/** Lets the host refocus the chat input after the popover closes. */
		onClose?: () => void;
		/** Fired when the chip is clicked so the host can open the picker. */
		onOpen?: () => void;
	}

	let {
		class: className = '',
		customAnchor = null,
		directory = null,
		disabled = false,
		isOpen,
		onChange,
		onClose,
		onOpen,
		query = $bindable('')
	}: Props = $props();

	// When the server does not serve file_glob_search or the user disabled
	// it, the picker still opens for manual entry but explains why search is
	// unavailable instead of firing searches that would only fail. Browse is
	// hidden too: it resolves the picked folder name through the same tool.
	const fileSearchKey = $derived(toolsStore.getPermissionKey(BuiltInTool.SERVER_FILE_GLOB_SEARCH));
	// effective policy: the active conversation's tool policy, or global defaults
	const fileSearchEnabled = $derived(
		fileSearchKey !== null &&
			conversationsStore.preferences.isToolEnabled(fileSearchKey) &&
			conversationsStore.preferences.isCategoryEnabled(ToolSource.SERVER)
	);
	const searchUnavailableMessage = $derived(
		fileSearchKey === null
			? 'File search is unavailable on this server - type a full path and press Enter'
			: 'File search is disabled - type a full path and press Enter, or enable "Search files" in Settings > Tools'
	);

	let searchInputRef: HTMLInputElement | null = $state(null);

	let queryResults = $state<string[]>([]);
	let searchError = $state<string | null>(null);
	let submitError = $state<string | null>(null);
	let listContainer = $state<HTMLDivElement | null>(null);

	const nav = usePickerNavigation({
		count: () => queryResults.length,
		isOpen: () => isOpen,
		onClose: closePicker,
		onSelect: (index) => commit(queryResults[index])
	});

	let homeBase = $derived(toolsStore.serverHome);

	// Resolve home eagerly so the chip can abbreviate before the picker opens.
	$effect(() => {
		if (typeof window === 'undefined') return;

		void toolsStore.resolveServerHome();
	});

	// HTML `autofocus` is unreliable on dynamically shown elements.
	$effect(() => {
		if (!isOpen) return;

		setTimeout(() => searchInputRef?.focus(), FOCUS_DELAY_MS);
	});

	$effect(() => {
		if (!isOpen) return;

		const q = query.trim();

		submitError = null;
		nav.reset(-1);

		if (q && fileSearchEnabled) {
			search.run(q);
		} else {
			search.cancel();
			queryResults = [];
			searchError = null;
			nav.reset(-1);
			searchScope = homeBase ?? HOME_TILDE;
		}
	});

	useScrollActiveRow({
		dataAttr: UI_DATA_ATTRS.RESULT_INDEX,
		getContainer: () => listContainer,
		getCount: () => queryResults.length,
		getIndex: () => nav.hoveredIndex,
		getTrigger: () => nav.scrollTrigger
	});

	let searchScope = $state(HOME_TILDE);

	// An exactly-typed directory is "entered": the shared search lists its
	// children too, so path navigation does not require a trailing slash.
	const search = useDebouncedSearch({
		canRun: () => isOpen && fileSearchEnabled,
		debounceMs: SEARCH.DEBOUNCE_MS,
		getQuery: () => query.trim(),
		run: async (q, signal, isCurrent) => {
			const trimmed = q.trim();

			if (!trimmed) {
				queryResults = [];
				searchError = null;
				nav.reset(-1);
				searchScope = homeBase ?? HOME_TILDE;

				return;
			}

			try {
				// Generous limit: ranking is client-side, only the top
				// MAX_RESULTS_SHOWN are shown.
				const res = await runGlobSearchWithChildren(
					trimmed,
					homeBase ?? HOME_TILDE,
					SEARCH.MAX_DEPTH,
					SEARCH.LIMIT,
					signal,
					{ type: GlobSearchType.DIR }
				);

				if (!isCurrent()) return;

				if (res.error) {
					queryResults = [];
					nav.reset(-1);
					searchError = res.error;

					return;
				}

				searchScope = res.exactDir ?? res.args.path;
				queryResults = res.entries.map((e) => e.path).slice(0, SEARCH.MAX_RESULTS_SHOWN);

				nav.reset(-1);

				searchError = null;
			} catch (err) {
				if (!isCurrent() || signal.aborted) return;

				queryResults = [];
				nav.reset(-1);
				searchError = err instanceof Error ? err.message : String(err);
			}
		}
	});
	// Single funnel for every local close so the host refocus always fires.
	function closePicker() {
		onClose?.();
	}

	function commit(path: string) {
		onChange?.(path);
		closePicker();
	}

	function setDirectory(value: string) {
		const trimmed = value.trim();

		if (!trimmed) return;

		onChange?.(trimmed);
	}

	async function handleSubmit() {
		const value = (searchInputRef?.value ?? query).trim();

		if (!value) {
			closePicker();

			return;
		}

		if (!fileSearchEnabled) {
			setDirectory(value);
			closePicker();

			return;
		}

		if (ROOT_PATH_REGEX.test(value)) {
			setDirectory(value);
			closePicker();

			return;
		}

		try {
			const res = await runGlobSearchWithChildren(
				value,
				homeBase ?? HOME_TILDE,
				SEARCH.PATH_NAV_MAX_DEPTH,
				5,
				new AbortController().signal,
				{ childMaxDepth: 0, type: GlobSearchType.DIR }
			);

			if (res.error) {
				submitError = res.error;

				return;
			}

			if (!res.exactDir) {
				submitError = `Directory not found: ${value}`;

				return;
			}

			setDirectory(res.exactDir);
			closePicker();
		} catch (err) {
			submitError = err instanceof Error ? err.message : String(err);
		}
	}

	export function handleKeydown(event: KeyboardEvent): boolean {
		if (event.key === KeyboardKey.ENTER) {
			event.preventDefault();

			if (nav.hoveredIndex >= 0 && queryResults[nav.hoveredIndex]) {
				commit(queryResults[nav.hoveredIndex]);
			} else {
				void handleSubmit();
			}

			return true;
		} else if (event.key === KeyboardKey.ARROW_DOWN) {
			if (queryResults.length > 0) {
				event.preventDefault();
				nav.move(1);

				return true;
			}
		} else if (event.key === KeyboardKey.ARROW_UP) {
			if (queryResults.length > 0) {
				event.preventDefault();
				nav.move(-1);

				return true;
			}
		} else if (event.key === KeyboardKey.ESCAPE) {
			event.preventDefault();
			closePicker();

			return true;
		}

		return false;
	}

	function clearDirectory(event?: MouseEvent) {
		// Stop the click from bubbling into the chip button and re-opening
		// the picker on top of the now-cleared state.
		event?.stopPropagation();
		event?.preventDefault();
		onChange?.(null);
		closePicker();
	}

	function handleDismiss(event?: MouseEvent) {
		event?.stopPropagation();
		event?.preventDefault();

		if (directory) {
			clearDirectory(event);
		}
	}

	function handleOpenChange(open: boolean) {
		if (open) {
			void toolsStore.resolveServerHome();
		} else {
			search.cancel();
			// bits-ui-initiated close (Escape on the content, outside-click) -
			// the only path that bypasses closePicker().
			onClose?.();
		}
	}

	let innerWidth = $state(0);
	const showTooltip = $derived(innerWidth > DEFAULT_MOBILE_BREAKPOINT);
</script>

<button
	class={[
		'justify-self-start flex min-w-0 w-auto items-center gap-1 mt-1.5 py-1 px-2 backdrop-blur-2xl rounded-md',
		className
	]}
	{disabled}
	onclick={onOpen}
	type="button"
>
	<ChatFormCurrentWorkingDirectoryChip
		{directory}
		{disabled}
		{homeBase}
		onClear={handleDismiss}
		{showTooltip}
	/>
</button>

<Popover.Root onOpenChange={handleOpenChange} open={isOpen}>
	<Popover.Trigger
		aria-hidden="true"
		class="pointer-events-none absolute inset-0 opacity-0"
		tabindex={-1}
	>
		<span class="sr-only">Open working directory picker</span>
	</Popover.Trigger>

	<Popover.Content
		align="start"
		class="w-[var(--bits-popover-anchor-width)] max-w-none rounded-xl border-border/50 p-0 shadow-xl"
		{customAnchor}
		onCloseAutoFocus={(event) => event.preventDefault()}
		onOpenAutoFocus={(event) => event.preventDefault()}
		onkeydown={handleKeydown}
		preventScroll={false}
		side="top"
		sideOffset={12}
	>
		<div class="p-2 min-h-22 flex flex-col justify-between">
			<SearchInput
				bind:ref={searchInputRef}
				bind:value={query}
				class="w-full"
				onClose={closePicker}
				placeholder="Type an absolute path or search"
			/>

			{#if submitError}
				<div class="px-2 py-1.5 text-sm text-destructive">{submitError}</div>
			{/if}

			{#if !fileSearchEnabled}
				<div class="px-2 py-1.5 text-sm text-muted-foreground">{searchUnavailableMessage}</div>
			{:else if query.trim() && (search.isSearching || queryResults.length > 0 || searchError)}
				<ChatFormCurrentWorkingDirectoryResultsList
					bind:container={listContainer}
					error={searchError}
					hoveredIndex={nav.hoveredIndex}
					isSearching={search.isSearching}
					onCommit={commit}
					onHover={(index) => nav.setHover(index)}
					rawQuery={query}
					results={queryResults}
				/>
			{/if}

			{#if !query.trim() && fileSearchEnabled}
				<div class="px-2 py-1.5 text-sm text-muted-foreground">
					Type an absolute server path (e.g. H:\proj) and press Enter.
				</div>
			{/if}

			{#if homeBase && fileSearchEnabled}
				<div aria-hidden="true" class="-mx-2 my-2 h-px bg-border/20"></div>

				<span class="px-2 py-1.5 font-mono text-[10px]">
					Searching in:

					<span class="truncate text-muted-foreground/70" title={searchScope}
						>{abbreviateHome(searchScope, homeBase)}</span
					>
				</span>
			{/if}
		</div>
	</Popover.Content>
</Popover.Root>

<svelte:window bind:innerWidth />
