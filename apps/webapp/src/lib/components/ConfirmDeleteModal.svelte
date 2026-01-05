<script lang="ts">
	let {
		open = $bindable(false),
		title = 'Confirm Delete',
		message = 'Are you sure you want to delete',
		itemName = '',
		onConfirm
	}: {
		open: boolean;
		title?: string;
		message?: string;
		itemName?: string;
		onConfirm: () => Promise<void>;
	} = $props();

	let deleting = $state(false);
	let error = $state<string | null>(null);

	async function handleConfirm() {
		deleting = true;
		error = null;
		try {
			await onConfirm();
			open = false;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to delete';
		} finally {
			deleting = false;
		}
	}

	function handleCancel() {
		if (!deleting) {
			open = false;
			error = null;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && !deleting) {
			handleCancel();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
		onclick={handleCancel}
		onkeydown={(e) => e.key === 'Escape' && handleCancel()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="delete-modal-title"
		tabindex="-1"
	>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="card w-full max-w-sm mx-4 p-6"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="document"
		>
			<div class="flex items-start gap-4">
				<div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
					<span class="material-icons text-red-600">warning</span>
				</div>
				<div class="flex-1 min-w-0">
					<h3 id="delete-modal-title" class="text-lg font-medium text-surface-900">
						{title}
					</h3>
					<p class="text-surface-600 mt-1">
						{message}
						{#if itemName}
							<strong class="text-surface-900">{itemName}</strong>?
						{/if}
					</p>
					<p class="text-sm text-surface-500 mt-2">
						This action cannot be undone.
					</p>
				</div>
			</div>

			{#if error}
				<div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
					{error}
				</div>
			{/if}

			<div class="flex justify-end gap-3 mt-6">
				<button
					type="button"
					class="btn btn-secondary"
					onclick={handleCancel}
					disabled={deleting}
				>
					Cancel
				</button>
				<button
					type="button"
					class="btn bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400"
					onclick={handleConfirm}
					disabled={deleting}
				>
					{#if deleting}
						<span class="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
						Deleting...
					{:else}
						Delete
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
