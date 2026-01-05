<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { productsApi } from '$lib/api/client';

	let companyId = $derived($page.params.companyId);

	let saving = $state(false);
	let error = $state<string | null>(null);

	let formData = $state({
		name: '',
		description: '',
		unitPrice: 0,
		taxRate: 15
	});

	async function createProduct() {
		if (!companyId) return;
		saving = true;
		error = null;
		try {
			await productsApi.create({ companyId, ...formData });
			goto(`/companies/${companyId}/products`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create product';
		} finally {
			saving = false;
		}
	}
</script>

<div class="p-6 max-w-2xl">
	<!-- Header -->
	<div class="flex items-center gap-4 mb-6">
		<button
			class="p-2 hover:bg-surface-100 rounded-lg transition-colors"
			onclick={() => goto(`/companies/${companyId}/products`)}
		>
			<span class="material-icons text-surface-600">arrow_back</span>
		</button>
		<div>
			<h1 class="text-2xl font-semibold text-surface-900">New Product</h1>
			<p class="text-surface-500 mt-1">Add a new product or service</p>
		</div>
	</div>

	{#if error}
		<div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
	{/if}

	<form class="card p-6 space-y-6" onsubmit={(e) => { e.preventDefault(); createProduct(); }}>
		<div>
			<label for="name" class="block text-sm font-medium text-surface-700 mb-1">Name *</label>
			<input
				id="name"
				type="text"
				class="input"
				placeholder="e.g. Consulting Services"
				bind:value={formData.name}
				required
			/>
		</div>

		<div>
			<label for="description" class="block text-sm font-medium text-surface-700 mb-1">Description</label>
			<textarea
				id="description"
				class="input"
				rows="3"
				placeholder="Brief description of the product or service"
				bind:value={formData.description}
			></textarea>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div>
				<label for="unitPrice" class="block text-sm font-medium text-surface-700 mb-1">Unit Price *</label>
				<input
					id="unitPrice"
					type="number"
					step="0.01"
					min="0"
					class="input"
					placeholder="0.00"
					bind:value={formData.unitPrice}
					required
				/>
			</div>
			<div>
				<label for="taxRate" class="block text-sm font-medium text-surface-700 mb-1">Tax Rate (%)</label>
				<input
					id="taxRate"
					type="number"
					step="0.01"
					min="0"
					max="100"
					class="input"
					placeholder="15"
					bind:value={formData.taxRate}
				/>
			</div>
		</div>

		<div class="flex justify-end gap-3 pt-4 border-t border-surface-200">
			<button
				type="button"
				class="btn btn-secondary"
				onclick={() => goto(`/companies/${companyId}/products`)}
			>
				Cancel
			</button>
			<button type="submit" class="btn btn-primary" disabled={saving}>
				{saving ? 'Creating...' : 'Create Product'}
			</button>
		</div>
	</form>
</div>
