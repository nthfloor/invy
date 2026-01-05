<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { creditNotesApi, invoicesApi, clientsApi, productsApi, type Invoice, type Client, type Product } from '$lib/api/client';

	let companyId = $derived($page.params.companyId);

	let clients = $state<Client[]>([]);
	let invoices = $state<Invoice[]>([]);
	let products = $state<Product[]>([]);
	let loading = $state(true);
	let creating = $state(false);
	let error = $state<string | null>(null);

	interface LineItem {
		id: string;
		invoiceItemId: string;
		productId: string;
		description: string;
		quantity: number;
		unitPrice: number;
		taxRate: number;
	}

	let formData = $state({
		clientId: '',
		invoiceId: '',
		issueDate: new Date().toISOString().split('T')[0],
		reason: '',
		notes: ''
	});

	let lineItems = $state<LineItem[]>([
		{ id: crypto.randomUUID(), invoiceItemId: '', productId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 15 }
	]);

	const totals = $derived(() => {
		const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
		const taxTotal = lineItems.reduce(
			(sum, item) => sum + (item.quantity * item.unitPrice * item.taxRate) / 100,
			0
		);
		return { subtotal, taxTotal, total: subtotal + taxTotal };
	});

	const filteredInvoices = $derived(
		formData.clientId
			? invoices.filter(inv => inv.clientId === formData.clientId && inv.status !== 'draft' && inv.status !== 'cancelled')
			: []
	);

	const selectedInvoice = $derived(
		invoices.find(inv => inv.id === formData.invoiceId)
	);

	onMount(async () => {
		await Promise.all([loadClients(), loadInvoices(), loadProducts()]);
		loading = false;
	});

	async function loadClients() {
		if (!companyId) return;
		try {
			const result = await clientsApi.list(companyId, { perPage: 100 });
			clients = result.data;
		} catch (e) {
			// Silently fail
		}
	}

	async function loadInvoices() {
		if (!companyId) return;
		try {
			const result = await invoicesApi.list(companyId, { perPage: 100 });
			invoices = result.data;
		} catch (e) {
			// Silently fail
		}
	}

	async function loadProducts() {
		if (!companyId) return;
		try {
			const result = await productsApi.list(companyId, { perPage: 100 });
			products = result.data;
		} catch (e) {
			// Silently fail
		}
	}

	function onClientChange() {
		formData.invoiceId = '';
		lineItems = [{ id: crypto.randomUUID(), invoiceItemId: '', productId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 15 }];
	}

	function onInvoiceSelect() {
		if (!selectedInvoice?.items) return;
		// Pre-populate line items from invoice
		lineItems = selectedInvoice.items.map(item => ({
			id: crypto.randomUUID(),
			invoiceItemId: item.id,
			productId: item.productId || '',
			description: item.description,
			quantity: item.quantity,
			unitPrice: item.unitPrice,
			taxRate: item.taxRate
		}));
	}

	function addLineItem() {
		lineItems = [
			...lineItems,
			{ id: crypto.randomUUID(), invoiceItemId: '', productId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 15 }
		];
	}

	function removeLineItem(id: string) {
		if (lineItems.length <= 1) return;
		lineItems = lineItems.filter(item => item.id !== id);
	}

	function onProductSelect(itemId: string, productId: string) {
		const product = products.find(p => p.id === productId);
		if (product) {
			lineItems = lineItems.map(item =>
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

	async function createCreditNote() {
		if (!companyId) return;
		if (!formData.clientId) {
			error = 'Please select a client';
			return;
		}
		if (!formData.invoiceId) {
			error = 'Please select an invoice';
			return;
		}
		if (!formData.reason) {
			error = 'Please provide a reason for the credit note';
			return;
		}
		if (lineItems.every(item => !item.description && item.unitPrice === 0)) {
			error = 'Please add at least one line item';
			return;
		}

		creating = true;
		error = null;
		try {
			await creditNotesApi.create({
				companyId,
				clientId: formData.clientId,
				invoiceId: formData.invoiceId,
				issueDate: formData.issueDate,
				reason: formData.reason,
				notes: formData.notes || undefined,
				items: lineItems
					.filter(item => item.description || item.unitPrice > 0)
					.map(item => ({
						invoiceItemId: item.invoiceItemId || undefined,
						productId: item.productId || undefined,
						description: item.description,
						quantity: item.quantity,
						unitPrice: item.unitPrice,
						taxRate: item.taxRate
					}))
			});
			goto(`/companies/${companyId}/credit-notes`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create credit note';
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
			onclick={() => goto(`/companies/${companyId}/credit-notes`)}
		>
			<span class="material-icons text-surface-600">arrow_back</span>
		</button>
		<div>
			<h1 class="text-2xl font-semibold text-surface-900">New Credit Note</h1>
			<p class="text-surface-500 mt-1">Issue a credit note against an invoice</p>
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
		<form class="card p-6" onsubmit={(e) => { e.preventDefault(); createCreditNote(); }}>
			<!-- Client & Invoice Selection -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
				<div>
					<label for="clientId" class="block text-sm font-medium text-surface-700 mb-1">Client *</label>
					<select id="clientId" class="input" bind:value={formData.clientId} onchange={onClientChange} required>
						<option value="">Select a client</option>
						{#each clients as client}
							<option value={client.id}>{client.name}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="invoiceId" class="block text-sm font-medium text-surface-700 mb-1">Invoice *</label>
					<select
						id="invoiceId"
						class="input"
						bind:value={formData.invoiceId}
						onchange={onInvoiceSelect}
						disabled={!formData.clientId}
						required
					>
						<option value="">Select an invoice</option>
						{#each filteredInvoices as invoice}
							<option value={invoice.id}>{invoice.invoiceNumber} - {formatCurrency(invoice.total)}</option>
						{/each}
					</select>
					{#if formData.clientId && filteredInvoices.length === 0}
						<p class="text-xs text-surface-500 mt-1">No invoices available for this client</p>
					{/if}
				</div>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
				<div>
					<label for="issueDate" class="block text-sm font-medium text-surface-700 mb-1">Issue Date</label>
					<input id="issueDate" type="date" class="input" bind:value={formData.issueDate} />
				</div>
				<div>
					<label for="reason" class="block text-sm font-medium text-surface-700 mb-1">Reason *</label>
					<input
						id="reason"
						type="text"
						class="input"
						placeholder="e.g. Goods returned, Service not delivered"
						bind:value={formData.reason}
						required
					/>
				</div>
			</div>

			<!-- Line Items -->
			<div class="mb-6">
				<div class="flex justify-between items-center mb-3">
					<h3 class="text-sm font-medium text-surface-700">Line Items</h3>
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
						<span class="text-surface-900">Credit Total</span>
						<span class="text-surface-900">{formatCurrency(totals().total)}</span>
					</div>
				</div>
			</div>

			<!-- Notes -->
			<div class="mb-6">
				<label for="notes" class="block text-sm font-medium text-surface-700 mb-1">Notes</label>
				<textarea
					id="notes"
					class="input"
					rows="3"
					placeholder="Additional notes..."
					bind:value={formData.notes}
				></textarea>
			</div>

			<!-- Actions -->
			<div class="flex justify-end gap-3 pt-4 border-t border-surface-200">
				<button type="button" class="btn btn-secondary" onclick={() => goto(`/companies/${companyId}/credit-notes`)}>
					Cancel
				</button>
				<button type="submit" class="btn btn-primary" disabled={creating}>
					{creating ? 'Creating...' : 'Create Credit Note'}
				</button>
			</div>
		</form>
	{/if}
</div>
