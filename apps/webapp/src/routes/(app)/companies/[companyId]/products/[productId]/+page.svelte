<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { productsApi, type Product } from '$lib/api/client';
	import ConfirmDeleteModal from '$lib/components/ConfirmDeleteModal.svelte';

	let companyId = $derived($page.params.companyId);
	let productId = $derived($page.params.productId);

	let product = $state<Product | null>(null);
	let loading = $state(true);
	let saving = $state(false);
	let error = $state<string | null>(null);

	let showDeleteModal = $state(false);

	let formData = $state({
		name: '',
		description: '',
		unitPrice: 0,
		currency: 'ZAR',
		taxRate: 15,
		isActive: true
	});

	onMount(async () => {
		await loadProduct();
	});

	async function loadProduct() {
		if (!companyId || !productId) return;
		loading = true;
		error = null;
		try {
			product = await productsApi.get(productId, companyId);
			formData = {
				name: product.name,
				description: product.description || '',
				unitPrice: product.unitPrice,
				currency: product.currency,
				taxRate: product.taxRate || 15,
				isActive: product.isActive
			};
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load product';
		} finally {
			loading = false;
		}
	}

	async function saveProduct() {
		if (!companyId || !productId) return;
		saving = true;
		error = null;
		try {
			await productsApi.update(productId, companyId, formData);
			goto(`/companies/${companyId}/products`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save product';
		} finally {
			saving = false;
		}
	}

	async function deleteProduct() {
		if (!companyId || !productId) return;
		await productsApi.delete(productId, companyId);
		goto(`/companies/${companyId}/products`);
	}

	function formatCurrency(amount: number) {
		return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
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
		<div class="flex-1">
			<h1 class="text-2xl font-semibold text-surface-900">
				{loading ? 'Loading...' : product?.name || 'Product'}
			</h1>
			<p class="text-surface-500 mt-1">Edit product details</p>
		</div>
		{#if product}
			<button
				class="btn bg-red-50 text-red-600 hover:bg-red-100"
				onclick={() => (showDeleteModal = true)}
			>
				<span class="material-icons text-sm">delete</span>
				Delete
			</button>
		{/if}
	</div>

	{#if error}
		<div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="text-surface-500">Loading product...</div>
		</div>
	{:else if product}
		<form class="card p-6 space-y-6" onsubmit={(e) => { e.preventDefault(); saveProduct(); }}>
			<div>
				<label for="name" class="block text-sm font-medium text-surface-700 mb-1">Name *</label>
				<input
					id="name"
					type="text"
					class="input"
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
					bind:value={formData.description}
				></textarea>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div>
					<label for="unitPrice" class="block text-sm font-medium text-surface-700 mb-1">Unit Price *</label>
					<input
						id="unitPrice"
						type="number"
						step="0.01"
						min="0"
						class="input"
						bind:value={formData.unitPrice}
						required
					/>
				</div>
				<div>
					<label for="currency" class="block text-sm font-medium text-surface-700 mb-1">Currency</label>
					<select id="currency" class="input" bind:value={formData.currency}>
						<option value="ZAR">ZAR</option>
						<option value="USD">USD</option>
						<option value="EUR">EUR</option>
						<option value="GBP">GBP</option>
					</select>
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
						bind:value={formData.taxRate}
					/>
				</div>
			</div>

			<div>
				<label class="flex items-center gap-3 cursor-pointer">
					<input
						type="checkbox"
						class="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
						bind:checked={formData.isActive}
					/>
					<span class="text-sm font-medium text-surface-700">Active</span>
				</label>
				<p class="text-xs text-surface-500 mt-1 ml-7">Inactive products won't appear in invoice creation</p>
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
					{saving ? 'Saving...' : 'Save Changes'}
				</button>
			</div>
		</form>
	{/if}
</div>

<ConfirmDeleteModal
	bind:open={showDeleteModal}
	title="Delete Product"
	message="Are you sure you want to delete"
	itemName={product?.name || ''}
	onConfirm={deleteProduct}
/>
