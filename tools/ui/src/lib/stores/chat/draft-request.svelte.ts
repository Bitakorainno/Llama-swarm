/**
 * DraftRequestStore - One-shot composer prefill requests
 *
 * Lets sibling UIs (the empty-state quick actions) drop text into the chat
 * composer. ChatScreenForm consumes the request reactively, so ordering
 * between a profile switch and the prefill is handled by the form.
 */

class DraftRequestStore {
	requested = $state<string | null>(null);

	clear() {
		this.requested = null;
	}

	request(text: string) {
		this.requested = text;
	}
}

export const draftRequestStore = new DraftRequestStore();
