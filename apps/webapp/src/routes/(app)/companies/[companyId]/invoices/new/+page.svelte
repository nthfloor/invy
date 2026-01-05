<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { invoicesApi, clientsApi, productsApi, type Client, type Product } from '$lib/api/client';

	let companyId = $derived($page.params.companyId);

	let clients = $state<Client[]>([]);
	let products = $state<Product[]>([]);
	let loading = $state(true);
	let creating = $state(false);
	let error = $state<string | null>(null);

	interface LineItem {
		id: string;
		productId: string;
		description: string;
		quantity: number;
		unitPrice: number;
		taxRate: number;
	}

	let formData = $state({
		clientId: '',
		issueDate: new Date().toISOString().split('T')[0],
		dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
		notes: '',
		terms: ''
	});

	let lineItems = $state<LineItem[]>([
		{ id: crypto.randomUUID(), productId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 15 }
	]);

	const totals = $derived(() => {
		const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
		const taxTotal = lineItems.reduce(
			(sum, item) => sum + (item.quantity * item.unitPrice * item.taxRate) / 100,
			0
		);
		return { subtotal, taxTotal, total: subtotal + taxTotal };
	});

	onMount(async () => {
		await Promise.all([loadClients(), loadProducts()]);
		loading = false;
	});

	async function loadClients() {
		if (!companyId) return;
		try {
			const result = await clientsApi.list(companyId, { perPage: 100 });
			clients = result.data;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load clients';
		}
	}

	async function loadProducts() {
		if (!companyId) return;
		try {
			const result = await productsApi.list(companyId, { perPage: 100 });
			products = result.data;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load products';
		}
	}

	function addLineItem() {
		lineItems = [
			...lineItems,
			{ id: crypto.randomUUID(), productId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 15 }
		];
	}

	function removeLineItem(id: string) {
		if (lineItems.length <= 1) return;
		lineItems = lineItems.filter((item) => item.id !== id);
	}

	function onProductSelect(itemId: string, productId: string) {
		const product = products.find((p) => p.id === productId);
		if (product) {
			lineItems = lineItems.map((item) =>
				item.id === itemId
					? {
							...item,
							productId,
							description: product.name,
							unitPrice: product.unitPrice,
							taxRate: product.taxRate || 15
						}
					: item
			);
		}
	}

	async function createInvoice() {
		if (!companyId) return;
		if (!formData.clientId) {
			error = 'Please select a client';
			return;
		}
		if (lineItems.every((item) => !item.description && item.unitPrice === 0)) {
			error = 'Please add at least one line item';
			return;
		}

		creating = true;
		error = null;
		try {
			const invoice = await invoicesApi.create({
				companyId,
				clientId: formData.clientId,
				issueDate: formData.issueDate,
				dueDate: formData.dueDate,
				notes: formData.notes || undefined,
				terms: formData.terms || undefined,
				items: lineItems
					.filter((item) => item.description || item.unitPrice > 0)
					.map((item) => ({
						productId: item.productId || undefined,
						description: item.description,
						quantity: item.quantity,
						unitPrice: item.unitPrice,
						taxRate: item.taxRate
					}))
			});
			goto(`/companies/${companyId}/invoices/${invoice.id}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create invoice';
		} finally {
			creating = false;
		}
	}

	function formatCurrency(amount: number) {
		return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
	}
</script>

<div class="p-6 max-w-4xl">
	<!-- Header -->
	<div class="flex items-center gap-4 mb-6">
		<button
			class="p-2 hover:bg-surface-100 rounded-lg transition-colors"
			onclick={() => goto(`/companies/${companyId}/invoices`)}
		>
			<span class="material-icons text-surface-600">arrow_back</span>
		</button>
		<div>
			<h1 class="text-2xl font-semibold text-surface-900">New Invoice</h1>
			<p class="text-surface-500 mt-1">Create a new invoice for a client</p>
		</div>
	</div>

	{#if error}
		<div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="text-surface-500">Loading...</div>
		</div>
	{:else}
		<form class="card p-6" onsubmit={(e) => { e.preventDefault(); createInvoice(); }}>
			<!-- Client & Dates -->
			<div class="space-y-4 mb-6">
				<h3 class="text-sm font-medium text-surface-900 uppercase tracking-wide">Invoice Details</h3>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div>
						<label for="clientId" class="block text-sm font-medium text-surface-700 mb-1">Client *</label>
						<select id="clientId" class="input" bind:value={formData.clientId} required>
							<option value="">Select a client</option>
							{#each clients as client}
								<option value={client.id}>{client.name}</option>
							{/each}
						</select>
						{#if clients.length === 0}
							<p class="text-xs text-surface-500 mt-1">
								<a href="/companies/{companyId}/clients/new" class="text-primary-600 hover:underline">Add a client</a> first
							</p>
						{/if}
					</div>
					<div>
						<label for="issueDate" class="block text-sm font-medium text-surface-700 mb-1">Issue Date</label>
						<input id="issueDate" type="date" class="input" bind:value={formData.issueDate} />
					</div>
					<div>
						<label for="dueDate" class="block text-sm font-medium text-surface-700 mb-1">Due Date</label>
						<input id="dueDate" type="date" class="input" bind:value={formData.dueDate} />
					</div>
				</div>
			</div>

			<!-- Line Items -->
			<div class="space-y-4 mb-6">
				<div class="flex justify-between items-center">
					<h3 class="text-sm font-medium text-surface-900 uppercase tracking-wide">Line Items</h3>
					<button type="button" class="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1" onclick={addLineItem}>
						<span class="material-icons text-sm">add</span>
						Add Item
					</button>
				</div>
				<div class="border border-surface-200 rounded-lg overflow-hidden">
					<table class="w-full text-sm">
						<thead class="bg-surface-50">
							<tr>
								<th class="text-left px-3 py-2 font-medium text-surface-600 w-48">Product</th>
								<th class="text-left px-3 py-2 font-medium text-surface-600">Description</th>
								<th class="text-right px-3 py-2 font-medium text-surface-600 w-20">Qty</th>
								<th class="text-right px-3 py-2 font-medium text-surface-600 w-28">Unit Price</th>
								<th class="text-right px-3 py-2 font-medium text-surface-600 w-20">Tax %</th>
								<th class="text-right px-3 py-2 font-medium text-surface-600 w-28">Total</th>
								<th class="w-10"></th>
							</tr>
						</thead>
						<tbody>
							{#each lineItems as item (item.id)}
								<tr class="border-t border-surface-200">
									<td class="px-2 py-2">
										<select
											class="input text-sm py-1.5"
											value={item.productId}
											onchange={(e) => onProductSelect(item.id, (e.target as HTMLSelectElement).value)}
										>
											<option value="">Custom</option>
											{#each products as product}
												<option value={product.id}>{product.name}</option>
											{/each}
										</select>
									</td>
									<td class="px-2 py-2">
										<input
											type="text"
											class="input text-sm py-1.5"
											placeholder="Description"
											bind:value={item.description}
										/>
									</td>
									<td class="px-2 py-2">
										<input
											type="number"
											min="1"
											class="input text-sm py-1.5 text-right"
											bind:value={item.quantity}
										/>
									</td>
									<td class="px-2 py-2">
										<input
											type="number"
											step="0.01"
											min="0"
											class="input text-sm py-1.5 text-right"
											bind:value={item.unitPrice}
										/>
									</td>
									<td class="px-2 py-2">
										<input
											type="number"
											step="0.01"
											min="0"
											max="100"
											class="input text-sm py-1.5 text-right"
											bind:value={item.taxRate}
										/>
									</td>
									<td class="px-3 py-2 text-right font-medium text-surface-900">
										{formatCurrency(item.quantity * item.unitPrice * (1 + item.taxRate / 100))}
									</td>
									<td class="px-2 py-2">
										{#if lineItems.length > 1}
											<button
												type="button"
												class="p-1 hover:bg-surface-100 rounded text-surface-400 hover:text-red-500"
												onclick={() => removeLineItem(item.id)}
											>
												<span class="material-icons text-lg">close</span>
											</button>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Totals -->
			<div class="flex justify-end mb-6">
				<div class="w-64 space-y-2">
					<div class="flex justify-between text-sm">
						<span class="text-surface-500">Subtotal</span>
						<span class="text-surface-900">{formatCurrency(totals().subtotal)}</span>
					</div>
					<div class="flex justify-between text-sm">
						<span class="text-surface-500">Tax</span>
						<span class="text-surface-900">{formatCurrency(totals().taxTotal)}</span>
					</div>
					<div class="flex justify-between text-base font-semibold border-t border-surface-200 pt-2">
						<span class="text-surface-900">Total</span>
						<span class="text-surface-900">{formatCurrency(totals().total)}</span>
					</div>
				</div>
			</div>

			<!-- Notes & Terms -->
			<div class="space-y-4 mb-6">
				<h3 class="text-sm font-medium text-surface-900 uppercase tracking-wide">Additional Information</h3>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label for="notes" class="block text-sm font-medium text-surface-700 mb-1">Notes</label>
						<textarea
							id="notes"
							class="input"
							rows="3"
							placeholder="Any additional notes for the client..."
							bind:value={formData.notes}
						></textarea>
					</div>
					<div>
						<label for="terms" class="block text-sm font-medium text-surface-700 mb-1">Terms & Conditions</label>
						<textarea
							id="terms"
							class="input"
							rows="3"
							placeholder="Payment terms, late fees, etc..."
							bind:value={formData.terms}
						></textarea>
					</div>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex justify-end gap-3 pt-4 border-t border-surface-200">
				<button type="button" class="btn btn-secondary" onclick={() => goto(`/companies/${companyId}/invoices`)}>
					Cancel
				</button>
				<button type="submit" class="btn btn-primary" disabled={creating}>
					{creating ? 'Creating...' : 'Create Invoice'}
				</button>
			</div>
		</form>
	{/if}
</div>
