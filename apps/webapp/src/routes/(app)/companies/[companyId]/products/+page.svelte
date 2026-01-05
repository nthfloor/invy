<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { productsApi, type Product } from '$lib/api/client';

	let companyId = $derived($page.params.companyId);

	let products = $state<Product[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let searchQuery = $state('');
	let showCreateModal = $state(false);
	let editingProduct = $state<Product | null>(null);

	let formData = $state({
		name: '',
		description: '',
		unitPrice: 0,
		currency: 'ZAR',
		taxRate: 15
	});

	onMount(async () => {
		await loadProducts();
	});

	async function loadProducts() {
		loading = true;
		error = null;
		try {
			const result = await productsApi.list(companyId, { search: searchQuery || undefined });
			products = result.data;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load products';
			// Demo data
			products = [
				{
					id: 'prod-1',
					companyId,
					name: 'Consulting Services',
					description: 'Professional consulting at hourly rate',
					unitPrice: 1500,
					currency: 'ZAR',
					taxRate: 15,
					isActive: true,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				},
				{
					id: 'prod-2',
					companyId,
					name: 'Software License',
					description: 'Annual software license fee',
					unitPrice: 12000,
					currency: 'ZAR',
					taxRate: 15,
					isActive: true,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				}
			];
			error = null;
		} finally {
			loading = false;
		}
	}

	function openCreateModal() {
		formData = { name: '', description: '', unitPrice: 0, currency: 'ZAR', taxRate: 15 };
		editingProduct = null;
		showCreateModal = true;
	}

	function openEditModal(product: Product) {
		formData = {
			name: product.name,
			description: product.description || '',
			unitPrice: product.unitPrice,
			currency: product.currency,
			taxRate: product.taxRate || 15
		};
		editingProduct = product;
		showCreateModal = true;
	}

	async function saveProduct() {
		try {
			if (editingProduct) {
				const updated = await productsApi.update(companyId, editingProduct.id, formData);
				products = products.map((p) => (p.id === updated.id ? updated : p));
			} else {
				const newProduct = await productsApi.create(companyId, formData);
				products = [...products, newProduct];
			}
			showCreateModal = false;
			formData = { name: '', description: '', unitPrice: 0, currency: 'ZAR', taxRate: 15 };
			editingProduct = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save product';
		}
	}

	async function deleteProduct(product: Product) {
		if (!confirm(`Are you sure you want to delete ${product.name}?`)) return;
		try {
			await productsApi.delete(companyId, product.id);
			products = products.filter((p) => p.id !== product.id);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to delete product';
		}
	}

	function formatCurrency(amount: number, currency: string) {
		return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(amount);
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
		<button class="btn btn-primary" onclick={openCreateModal}>
			<span class="material-icons text-sm">add</span>
			Add Product
		</button>
	</div>

	<div class="mb-6">
		<div class="relative max-w-md">
			<span class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 material-icons text-lg">
				search
			</span>
			<input
				type="text"
				placeholder="Search products..."
				class="input pl-10"
				bind:value={searchQuery}
			/>
		</div>
	</div>

	{#if error}
		<div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="text-surface-500">Loading products...</div>
		</div>
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
				<button class="btn btn-primary" onclick={openCreateModal}>
					<span class="material-icons text-sm">add</span>
					Add Product
				</button>
			{/if}
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each filteredProducts as product}
				<div class="card p-5">
					<div class="flex justify-between items-start mb-3">
						<div>
							<h3 class="font-medium text-surface-900">{product.name}</h3>
							{#if product.description}
								<p class="text-sm text-surface-500 mt-1 line-clamp-2">{product.description}</p>
							{/if}
						</div>
						<div class="flex items-center gap-1">
							<button
								class="p-1 hover:bg-surface-100 rounded"
								onclick={() => openEditModal(product)}
								title="Edit"
							>
								<span class="material-icons text-lg text-surface-500">edit</span>
							</button>
							<button
								class="p-1 hover:bg-surface-100 rounded"
								onclick={() => deleteProduct(product)}
								title="Delete"
							>
								<span class="material-icons text-lg text-red-500">delete</span>
							</button>
						</div>
					</div>
					<div class="flex justify-between items-end">
						<div>
							<p class="text-xl font-semibold text-surface-900">
								{formatCurrency(product.unitPrice, product.currency)}
							</p>
							{#if product.taxRate}
								<p class="text-xs text-surface-400">+ {product.taxRate}% VAT</p>
							{/if}
						</div>
						<span class="badge {product.isActive ? 'badge-success' : 'badge-error'}">
							{product.isActive ? 'Active' : 'Inactive'}
						</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if showCreateModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
		<div class="card w-full max-w-md mx-4">
			<div class="p-4 border-b border-surface-200 flex justify-between items-center">
				<h2 class="text-lg font-medium text-surface-900">
					{editingProduct ? 'Edit Product' : 'Add Product'}
				</h2>
				<button class="text-surface-400 hover:text-surface-600" onclick={() => (showCreateModal = false)}>
					<span class="material-icons">close</span>
				</button>
			</div>
			<form class="p-4 space-y-4" onsubmit={(e) => { e.preventDefault(); saveProduct(); }}>
				<div>
					<label for="name" class="block text-sm font-medium text-surface-700 mb-1">Name *</label>
					<input id="name" type="text" class="input" bind:value={formData.name} required />
				</div>
				<div>
					<label for="description" class="block text-sm font-medium text-surface-700 mb-1">Description</label>
					<textarea id="description" class="input" rows="2" bind:value={formData.description}></textarea>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="unitPrice" class="block text-sm font-medium text-surface-700 mb-1">Unit Price *</label>
						<input id="unitPrice" type="number" step="0.01" class="input" bind:value={formData.unitPrice} required />
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
				</div>
				<div>
					<label for="taxRate" class="block text-sm font-medium text-surface-700 mb-1">Tax Rate (%)</label>
					<input id="taxRate" type="number" step="0.01" class="input" bind:value={formData.taxRate} />
				</div>
				<div class="flex justify-end gap-3 pt-4">
					<button type="button" class="btn btn-secondary" onclick={() => (showCreateModal = false)}>Cancel</button>
					<button type="submit" class="btn btn-primary">{editingProduct ? 'Save Changes' : 'Add Product'}</button>
				</div>
			</form>
		</div>
	</div>
{/if}
