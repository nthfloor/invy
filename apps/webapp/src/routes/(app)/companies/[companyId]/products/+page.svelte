<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { productsApi, type Product } from '$lib/api/client';
	import ConfirmDeleteModal from '$lib/components/ConfirmDeleteModal.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';

	let companyId = $derived($page.params.companyId);

	let products = $state<Product[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let searchQuery = $state('');

	let showDeleteModal = $state(false);
	let productToDelete = $state<Product | null>(null);

	onMount(async () => {
		await loadProducts();
	});

	async function loadProducts() {
		if (!companyId) return;
		loading = true;
		error = null;
		try {
			const result = await productsApi.list(companyId, { search: searchQuery || undefined });
			products = result.data;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load products';
		} finally {
			loading = false;
		}
	}

	function openDeleteModal(product: Product) {
		productToDelete = product;
		showDeleteModal = true;
	}

	async function deleteProduct() {
		if (!companyId || !productToDelete) return;
		await productsApi.delete(productToDelete.id, companyId);
		products = products.filter((p) => p.id !== productToDelete!.id);
		productToDelete = null;
	}

	function formatCurrency(amount: number) {
		return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
	}

	const filteredProducts = $derived(
		searchQuery
			? products.filter(
					(p) =>
						p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
						p.description?.toLowerCase().includes(searchQuery.toLowerCase())
				)
			: products
	);
</script>

<div class="p-6">
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
		<div>
			<h1 class="text-2xl font-semibold text-surface-900">Products</h1>
			<p class="text-surface-500 mt-1">Manage your products and services</p>
		</div>
		<button class="btn btn-primary" onclick={() => goto(`/companies/${companyId}/products/new`)}>
			<span class="material-icons text-sm">add</span>
			Add Product
		</button>
	</div>

	<div class="mb-6">
		<div class="flex items-center max-w-md border border-surface-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500">
			<span class="pl-3 text-surface-400 material-icons text-lg">search</span>
			<input
				type="text"
				placeholder="Search products..."
				class="flex-1 px-3 py-2 bg-transparent border-none focus:outline-none focus:ring-0"
				bind:value={searchQuery}
			/>
		</div>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="text-surface-500">Loading products...</div>
		</div>
	{:else if error}
		<ErrorState
			title="Unable to Load Products"
			message={error}
			onRetry={loadProducts}
		/>
	{:else if filteredProducts.length === 0}
		<div class="card p-8 text-center">
			<div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
				<span class="material-icons text-3xl text-surface-400">inventory_2</span>
			</div>
			<h3 class="text-lg font-medium text-surface-900 mb-2">
				{searchQuery ? 'No products found' : 'No products yet'}
			</h3>
			<p class="text-surface-500 mb-4">
				{searchQuery ? 'Try a different search term' : 'Add your first product to get started'}
			</p>
			{#if !searchQuery}
				<button class="btn btn-primary" onclick={() => goto(`/companies/${companyId}/products/new`)}>
					<span class="material-icons text-sm">add</span>
					Add Product
				</button>
			{/if}
		</div>
	{:else}
		<div class="card overflow-hidden">
			<table class="table">
				<thead>
					<tr>
						<th>Name</th>
						<th>Description</th>
						<th class="text-right">Unit Price</th>
						<th class="text-right">Tax Rate</th>
						<th>Status</th>
						<th class="w-24">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredProducts as product}
						<tr
							class="cursor-pointer hover:bg-surface-50"
							onclick={() => goto(`/companies/${companyId}/products/${product.id}`)}
						>
							<td class="font-medium text-surface-900">{product.name}</td>
							<td class="text-surface-600 max-w-xs truncate">{product.description || '-'}</td>
							<td class="text-right font-medium text-surface-900">{formatCurrency(product.unitPrice)}</td>
							<td class="text-right text-surface-600">{product.taxRate || 0}%</td>
							<td>
								<span class="badge {product.isActive ? 'badge-success' : 'badge-error'}">
									{product.isActive ? 'Active' : 'Inactive'}
								</span>
							</td>
							<td>
								<div class="flex items-center gap-1">
									<button
										class="p-1 hover:bg-surface-100 rounded"
										onclick={(e) => { e.stopPropagation(); goto(`/companies/${companyId}/products/${product.id}`); }}
										title="Edit"
									>
										<span class="material-icons text-lg text-surface-500">edit</span>
									</button>
									<button
										class="p-1 hover:bg-surface-100 rounded"
										onclick={(e) => { e.stopPropagation(); openDeleteModal(product); }}
										title="Delete"
									>
										<span class="material-icons text-lg text-red-500">delete</span>
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<ConfirmDeleteModal
	bind:open={showDeleteModal}
	title="Delete Product"
	message="Are you sure you want to delete"
	itemName={productToDelete?.name || ''}
	onConfirm={deleteProduct}
/>
