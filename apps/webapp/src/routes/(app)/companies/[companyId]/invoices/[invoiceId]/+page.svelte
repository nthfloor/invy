<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { invoicesApi, paymentsApi, productsApi, type Invoice, type Payment, type Product, type InvoiceItem } from '$lib/api/client';
	import ConfirmDeleteModal from '$lib/components/ConfirmDeleteModal.svelte';

	let companyId = $derived($page.params.companyId);
	let invoiceId = $derived($page.params.invoiceId);

	let invoice = $state<Invoice | null>(null);
	let payments = $state<Payment[]>([]);
	let products = $state<Product[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let showPaymentModal = $state(false);
	let recording = $state(false);
	let isEditing = $state(false);
	let saving = $state(false);
	let showAddItemModal = $state(false);
	let editingItemId = $state<string | null>(null);
	let showDeleteItemModal = $state(false);
	let itemToDelete = $state<InvoiceItem | null>(null);

	let paymentForm = $state({
		amount: 0,
		paymentDate: new Date().toISOString().split('T')[0],
		paymentMethod: 'bank_transfer',
		reference: '',
		notes: ''
	});

	let editForm = $state({
		issueDate: '',
		dueDate: '',
		notes: '',
		terms: ''
	});

	let itemForm = $state({
		productId: '',
		description: '',
		quantity: 1,
		unitPrice: 0,
		taxRate: 15
	});

	onMount(async () => {
		await Promise.all([loadInvoice(), loadProducts()]);
	});

	async function loadProducts() {
		if (!companyId) return;
		try {
			const result = await productsApi.list(companyId, { perPage: 100 });
			products = result.data;
		} catch (e) {
			// Silently fail - products are optional for editing
		}
	}

	async function loadInvoice() {
		if (!companyId || !invoiceId) return;
		loading = true;
		error = null;
		try {
			invoice = await invoicesApi.get(invoiceId, companyId);
			// Load payments for this invoice
			const paymentResult = await paymentsApi.getByInvoice(invoiceId, companyId);
			payments = paymentResult;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load invoice';
			// Demo data
			invoice = {
				id: invoiceId,
				companyId: companyId,
				clientId: 'client-1',
				invoiceNumber: 'INV-2025-001',
				status: 'sent',
				issueDate: '2025-01-01',
				dueDate: '2025-01-31',
				subtotal: 15000,
				taxTotal: 2250,
				total: 17250,
				amountPaid: 0,
				balance: 17250,
				notes: 'Thank you for your business!',
				terms: 'Payment due within 30 days.',
				items: [
					{
						id: 'item-1',
						invoiceId: invoiceId,
						description: 'Consulting Services',
						quantity: 10,
						unitPrice: 1500,
						taxRate: 15,
						lineTotal: 15000,
						lineTax: 2250,
						sortOrder: 0
					}
				],
				client: {
					id: 'client-1',
					companyId: companyId,
					name: 'John Smith',
					email: 'john@example.com',
					isActive: true,
					createdOn: '',
					updatedOn: ''
				},
				createdOn: new Date().toISOString(),
				updatedOn: new Date().toISOString()
			};
			payments = [];
			error = null;
		} finally {
			loading = false;
		}
	}

	async function sendInvoice() {
		if (!invoice || !companyId) return;
		if (!confirm(`Send invoice ${invoice.invoiceNumber} to ${invoice.client?.email || 'client'}?`)) return;
		try {
			await invoicesApi.markAsSent(invoice.id, companyId);
			invoice = { ...invoice, status: 'sent' };
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to send invoice';
		}
	}

	function openPaymentModal() {
		paymentForm = {
			amount: invoice?.balance || 0,
			paymentDate: new Date().toISOString().split('T')[0],
			paymentMethod: 'bank_transfer',
			reference: '',
			notes: ''
		};
		showPaymentModal = true;
	}

	async function recordPayment() {
		if (!companyId || !invoiceId) return;
		recording = true;
		error = null;
		try {
			const payment = await paymentsApi.create({
				companyId,
				invoiceId,
				amount: paymentForm.amount,
				paymentDate: paymentForm.paymentDate,
				paymentMethod: paymentForm.paymentMethod,
				reference: paymentForm.reference || undefined,
				notes: paymentForm.notes || undefined
			});
			payments = [payment, ...payments];
			// Refresh invoice to get updated balance
			await loadInvoice();
			showPaymentModal = false;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to record payment';
		} finally {
			recording = false;
		}
	}

	function downloadPdf() {
		if (!companyId || !invoiceId) return;
		const url = invoicesApi.getPdfUrl(invoiceId, companyId, true);
		window.open(url, '_blank');
	}

	function viewPdf() {
		if (!companyId || !invoiceId) return;
		const url = invoicesApi.getPdfUrl(invoiceId, companyId, false);
		window.open(url, '_blank');
	}

	function startEditing() {
		if (!invoice) return;
		editForm = {
			issueDate: invoice.issueDate.split('T')[0],
			dueDate: invoice.dueDate.split('T')[0],
			notes: invoice.notes || '',
			terms: invoice.terms || ''
		};
		isEditing = true;
	}

	function cancelEditing() {
		isEditing = false;
		editingItemId = null;
	}

	async function saveInvoice() {
		if (!companyId || !invoiceId) return;
		saving = true;
		error = null;
		try {
			await invoicesApi.update(invoiceId, companyId, {
				issueDate: editForm.issueDate,
				dueDate: editForm.dueDate,
				notes: editForm.notes || undefined,
				terms: editForm.terms || undefined
			});
			await loadInvoice();
			isEditing = false;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save invoice';
		} finally {
			saving = false;
		}
	}

	function openAddItemModal() {
		itemForm = {
			productId: '',
			description: '',
			quantity: 1,
			unitPrice: 0,
			taxRate: 15
		};
		editingItemId = null;
		showAddItemModal = true;
	}

	function openEditItemModal(item: InvoiceItem) {
		itemForm = {
			productId: item.productId || '',
			description: item.description,
			quantity: item.quantity,
			unitPrice: item.unitPrice,
			taxRate: item.taxRate
		};
		editingItemId = item.id;
		showAddItemModal = true;
	}

	function onProductSelect() {
		const product = products.find(p => p.id === itemForm.productId);
		if (product) {
			itemForm.description = product.name;
			itemForm.unitPrice = product.unitPrice;
			itemForm.taxRate = product.taxRate || 15;
		}
	}

	async function saveItem() {
		if (!companyId || !invoiceId) return;
		saving = true;
		error = null;
		try {
			const itemData = {
				productId: itemForm.productId || undefined,
				description: itemForm.description,
				quantity: Number(itemForm.quantity),
				unitPrice: Number(itemForm.unitPrice),
				taxRate: Number(itemForm.taxRate)
			};
			if (editingItemId) {
				await invoicesApi.updateItem(invoiceId, editingItemId, companyId, itemData);
			} else {
				await invoicesApi.addItem(invoiceId, companyId, itemData);
			}
			await loadInvoice();
			showAddItemModal = false;
			editingItemId = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save item';
		} finally {
			saving = false;
		}
	}

	function openDeleteItemModal(item: InvoiceItem) {
		itemToDelete = item;
		showDeleteItemModal = true;
	}

	async function removeItem() {
		if (!companyId || !invoiceId || !itemToDelete) return;
		try {
			await invoicesApi.removeItem(invoiceId, itemToDelete.id, companyId);
			await loadInvoice();
			itemToDelete = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to remove item';
		}
	}

	function formatCurrency(amount: number) {
		return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
	}

	function formatDate(date: string) {
		return new Date(date).toLocaleDateString('en-ZA', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function getStatusClass(status: string) {
		switch (status) {
			case 'paid':
				return 'badge-success';
			case 'sent':
				return 'bg-blue-100 text-blue-700';
			case 'overdue':
				return 'badge-error';
			case 'draft':
				return 'bg-surface-200 text-surface-600';
			case 'partial':
				return 'bg-yellow-100 text-yellow-700';
			case 'cancelled':
				return 'bg-surface-200 text-surface-500';
			default:
				return 'bg-surface-200 text-surface-600';
		}
	}

	function getMethodLabel(method: string) {
		const labels: Record<string, string> = {
			bank_transfer: 'Bank Transfer',
			card: 'Card',
			cash: 'Cash',
			eft: 'EFT',
			other: 'Other'
		};
		return labels[method] || method;
	}
</script>

<div class="p-6">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
		<div class="flex items-center gap-4">
			<button class="p-2 hover:bg-surface-100 rounded-lg" onclick={() => goto(`/companies/${companyId}/invoices`)}>
				<span class="material-icons text-surface-500">arrow_back</span>
			</button>
			<div>
				<div class="flex items-center gap-3">
					<h1 class="text-2xl font-semibold text-surface-900">
						{invoice?.invoiceNumber || 'Loading...'}
					</h1>
					{#if invoice}
						<span class="badge {getStatusClass(invoice.status)} capitalize">
							{invoice.status}
						</span>
					{/if}
				</div>
				{#if invoice?.client}
					<p class="text-surface-500 mt-1">{invoice.client.name}</p>
				{/if}
			</div>
		</div>
		{#if invoice}
			<div class="flex items-center gap-2">
				{#if invoice.status === 'draft' && !isEditing}
					<button class="btn btn-secondary" onclick={startEditing}>
						<span class="material-icons text-sm">edit</span>
						Edit
					</button>
					<button class="btn btn-primary" onclick={sendInvoice}>
						<span class="material-icons text-sm">send</span>
						Send Invoice
					</button>
				{:else if isEditing}
					<button class="btn btn-secondary" onclick={cancelEditing} disabled={saving}>
						Cancel
					</button>
					<button class="btn btn-primary" onclick={saveInvoice} disabled={saving}>
						{saving ? 'Saving...' : 'Save Changes'}
					</button>
				{/if}
				{#if !isEditing && invoice.status !== 'paid' && invoice.status !== 'cancelled' && invoice.balance > 0}
					<button class="btn btn-secondary" onclick={openPaymentModal}>
						<span class="material-icons text-sm">payment</span>
						Record Payment
					</button>
				{/if}
				{#if !isEditing}
					<button class="btn btn-secondary" onclick={viewPdf}>
						<span class="material-icons text-sm">visibility</span>
						View PDF
					</button>
					<button class="btn btn-secondary" onclick={downloadPdf}>
						<span class="material-icons text-sm">download</span>
						Download
					</button>
				{/if}
			</div>
		{/if}
	</div>

	{#if error}
		<div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="text-surface-500">Loading invoice...</div>
		</div>
	{:else if invoice}
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- Main Content -->
			<div class="lg:col-span-2 space-y-6">
				<!-- Invoice Details -->
				<div class="card p-6">
					<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
						<div>
							<p class="text-sm text-surface-500">Issue Date</p>
							{#if isEditing}
								<input type="date" class="input mt-1" bind:value={editForm.issueDate} />
							{:else}
								<p class="font-medium text-surface-900">{formatDate(invoice.issueDate)}</p>
							{/if}
						</div>
						<div>
							<p class="text-sm text-surface-500">Due Date</p>
							{#if isEditing}
								<input type="date" class="input mt-1" bind:value={editForm.dueDate} />
							{:else}
								<p class="font-medium text-surface-900">{formatDate(invoice.dueDate)}</p>
							{/if}
						</div>
						<div>
							<p class="text-sm text-surface-500">Client</p>
							<p class="font-medium text-surface-900">{invoice.client?.name || 'Unknown'}</p>
						</div>
						<div>
							<p class="text-sm text-surface-500">Email</p>
							<p class="font-medium text-surface-900">{invoice.client?.email || 'N/A'}</p>
						</div>
					</div>

					<!-- Line Items -->
					<div class="flex justify-between items-center mb-3">
						<h3 class="text-sm font-medium text-surface-700">Line Items</h3>
						{#if isEditing}
							<button class="btn btn-sm btn-secondary" onclick={openAddItemModal}>
								<span class="material-icons text-sm">add</span>
								Add Item
							</button>
						{/if}
					</div>
					<div class="border border-surface-200 rounded-lg overflow-hidden mb-6">
						<table class="w-full text-sm">
							<thead class="bg-surface-50">
								<tr>
									<th class="text-left px-4 py-3 font-medium text-surface-600">Description</th>
									<th class="text-right px-4 py-3 font-medium text-surface-600 w-20">Qty</th>
									<th class="text-right px-4 py-3 font-medium text-surface-600 w-28">Unit Price</th>
									<th class="text-right px-4 py-3 font-medium text-surface-600 w-20">Tax</th>
									<th class="text-right px-4 py-3 font-medium text-surface-600 w-28">Total</th>
									{#if isEditing}
										<th class="w-20"></th>
									{/if}
								</tr>
							</thead>
							<tbody>
								{#if invoice.items && invoice.items.length > 0}
									{#each invoice.items as item}
										<tr class="border-t border-surface-200">
											<td class="px-4 py-3 text-surface-900">{item.description}</td>
											<td class="px-4 py-3 text-right text-surface-600">{item.quantity}</td>
											<td class="px-4 py-3 text-right text-surface-600">{formatCurrency(item.unitPrice || 0)}</td>
											<td class="px-4 py-3 text-right text-surface-600">{item.taxRate || 0}%</td>
											<td class="px-4 py-3 text-right font-medium text-surface-900">
												{formatCurrency((Number(item.lineTotal) || 0) + (Number(item.lineTax) || 0))}
											</td>
											{#if isEditing}
												<td class="px-2 py-3">
													<div class="flex items-center gap-1">
														<button
															class="p-1 hover:bg-surface-100 rounded text-surface-500 hover:text-surface-700"
															onclick={() => openEditItemModal(item)}
															title="Edit item"
														>
															<span class="material-icons text-sm">edit</span>
														</button>
														<button
															class="p-1 hover:bg-red-50 rounded text-surface-500 hover:text-red-600"
															onclick={() => openDeleteItemModal(item)}
															title="Remove item"
														>
															<span class="material-icons text-sm">delete</span>
														</button>
													</div>
												</td>
											{/if}
										</tr>
									{/each}
								{:else}
									<tr>
										<td colspan={isEditing ? 6 : 5} class="px-4 py-8 text-center text-surface-500">
											No line items
										</td>
									</tr>
								{/if}
							</tbody>
						</table>
					</div>

					<!-- Totals -->
					<div class="flex justify-end">
						<div class="w-72 space-y-2">
							<div class="flex justify-between text-sm">
								<span class="text-surface-500">Subtotal</span>
								<span class="text-surface-900">{formatCurrency(invoice.subtotal || 0)}</span>
							</div>
							<div class="flex justify-between text-sm">
								<span class="text-surface-500">Tax</span>
								<span class="text-surface-900">{formatCurrency(invoice.taxTotal || 0)}</span>
							</div>
							<div class="flex justify-between text-base font-semibold border-t border-surface-200 pt-2">
								<span class="text-surface-900">Total</span>
								<span class="text-surface-900">{formatCurrency(invoice.total || 0)}</span>
							</div>
							{#if (invoice.amountPaid || 0) > 0}
								<div class="flex justify-between text-sm text-green-600">
									<span>Amount Paid</span>
									<span>-{formatCurrency(invoice.amountPaid || 0)}</span>
								</div>
							{/if}
							<div class="flex justify-between text-base font-semibold border-t border-surface-200 pt-2">
								<span class="text-surface-900">Balance Due</span>
								<span class="text-surface-900 {(invoice.balance || 0) > 0 ? '' : 'text-green-600'}">
									{formatCurrency(invoice.balance || 0)}
								</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Notes & Terms -->
				{#if isEditing || invoice.notes || invoice.terms}
					<div class="card p-6">
						<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div>
								<h3 class="text-sm font-medium text-surface-700 mb-2">Notes</h3>
								{#if isEditing}
									<textarea
										class="input"
										rows="3"
										placeholder="Internal notes"
										bind:value={editForm.notes}
									></textarea>
								{:else if invoice.notes}
									<p class="text-surface-600 text-sm whitespace-pre-wrap">{invoice.notes}</p>
								{:else}
									<p class="text-surface-400 text-sm">No notes</p>
								{/if}
							</div>
							<div>
								<h3 class="text-sm font-medium text-surface-700 mb-2">Terms & Conditions</h3>
								{#if isEditing}
									<textarea
										class="input"
										rows="3"
										placeholder="Terms and conditions"
										bind:value={editForm.terms}
									></textarea>
								{:else if invoice.terms}
									<p class="text-surface-600 text-sm whitespace-pre-wrap">{invoice.terms}</p>
								{:else}
									<p class="text-surface-400 text-sm">No terms</p>
								{/if}
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Sidebar -->
			<div class="space-y-6">
				<!-- Payment Summary -->
				<div class="card p-5">
					<h3 class="text-sm font-medium text-surface-700 mb-4">Payment Summary</h3>
					<div class="space-y-3">
						<div class="flex justify-between">
							<span class="text-surface-500">Total Amount</span>
							<span class="font-medium text-surface-900">{formatCurrency(invoice.total || 0)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-surface-500">Amount Paid</span>
							<span class="font-medium text-green-600">{formatCurrency(invoice.amountPaid || 0)}</span>
						</div>
						<div class="flex justify-between border-t border-surface-200 pt-3">
							<span class="font-medium text-surface-900">Balance Due</span>
							<span class="font-semibold {(invoice.balance || 0) > 0 ? 'text-red-600' : 'text-green-600'}">
								{formatCurrency(invoice.balance || 0)}
							</span>
						</div>
					</div>
				</div>

				<!-- Payment History -->
				<div class="card p-5">
					<h3 class="text-sm font-medium text-surface-700 mb-4">Payment History</h3>
					{#if payments.length === 0}
						<p class="text-surface-500 text-sm">No payments recorded</p>
					{:else}
						<div class="space-y-3">
							{#each payments as payment}
								<div class="flex justify-between items-start py-2 border-b border-surface-100 last:border-0">
									<div>
										<p class="font-medium text-surface-900">{formatCurrency(payment.amount)}</p>
										<p class="text-xs text-surface-500">{formatDate(payment.paymentDate)}</p>
										<p class="text-xs text-surface-400">{getMethodLabel(payment.paymentMethod)}</p>
									</div>
									<span class="badge bg-green-100 text-green-700 text-xs">
										{payment.status}
									</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Record Payment Modal -->
{#if showPaymentModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
		<div class="card w-full max-w-md mx-4">
			<div class="p-4 border-b border-surface-200 flex justify-between items-center">
				<h2 class="text-lg font-medium text-surface-900">Record Payment</h2>
				<button class="text-surface-400 hover:text-surface-600" onclick={() => (showPaymentModal = false)}>
					<span class="material-icons">close</span>
				</button>
			</div>
			<form class="p-4 space-y-4" onsubmit={(e) => { e.preventDefault(); recordPayment(); }}>
				<div>
					<label for="amount" class="block text-sm font-medium text-surface-700 mb-1">Amount *</label>
					<input
						id="amount"
						type="number"
						step="0.01"
						min="0.01"
						max={invoice?.balance || 0}
						class="input"
						bind:value={paymentForm.amount}
						required
					/>
					{#if invoice}
						<p class="text-xs text-surface-500 mt-1">Balance due: {formatCurrency(invoice.balance)}</p>
					{/if}
				</div>
				<div>
					<label for="paymentDate" class="block text-sm font-medium text-surface-700 mb-1">Payment Date *</label>
					<input id="paymentDate" type="date" class="input" bind:value={paymentForm.paymentDate} required />
				</div>
				<div>
					<label for="paymentMethod" class="block text-sm font-medium text-surface-700 mb-1">Payment Method *</label>
					<select id="paymentMethod" class="input" bind:value={paymentForm.paymentMethod} required>
						<option value="bank_transfer">Bank Transfer</option>
						<option value="eft">EFT</option>
						<option value="card">Card</option>
						<option value="cash">Cash</option>
						<option value="other">Other</option>
					</select>
				</div>
				<div>
					<label for="reference" class="block text-sm font-medium text-surface-700 mb-1">Reference</label>
					<input id="reference" type="text" class="input" bind:value={paymentForm.reference} placeholder="Transaction reference" />
				</div>
				<div>
					<label for="notes" class="block text-sm font-medium text-surface-700 mb-1">Notes</label>
					<textarea id="notes" class="input" rows="2" bind:value={paymentForm.notes}></textarea>
				</div>
				<div class="flex justify-end gap-3 pt-4">
					<button type="button" class="btn btn-secondary" onclick={() => (showPaymentModal = false)}>
						Cancel
					</button>
					<button type="submit" class="btn btn-primary" disabled={recording}>
						{#if recording}
							Recording...
						{:else}
							Record Payment
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Add/Edit Item Modal -->
{#if showAddItemModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
		<div class="card w-full max-w-md mx-4">
			<div class="p-4 border-b border-surface-200 flex justify-between items-center">
				<h2 class="text-lg font-medium text-surface-900">
					{editingItemId ? 'Edit Line Item' : 'Add Line Item'}
				</h2>
				<button class="text-surface-400 hover:text-surface-600" onclick={() => (showAddItemModal = false)}>
					<span class="material-icons">close</span>
				</button>
			</div>
			<form class="p-4 space-y-4" onsubmit={(e) => { e.preventDefault(); saveItem(); }}>
				{#if products.length > 0}
					<div>
						<label for="productId" class="block text-sm font-medium text-surface-700 mb-1">Product (Optional)</label>
						<select id="productId" class="input" bind:value={itemForm.productId} onchange={onProductSelect}>
							<option value="">-- Select a product --</option>
							{#each products as product}
								<option value={product.id}>{product.name} - {formatCurrency(product.unitPrice)}</option>
							{/each}
						</select>
					</div>
				{/if}
				<div>
					<label for="itemDescription" class="block text-sm font-medium text-surface-700 mb-1">Description *</label>
					<input
						id="itemDescription"
						type="text"
						class="input"
						placeholder="Item description"
						bind:value={itemForm.description}
						required
					/>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="itemQuantity" class="block text-sm font-medium text-surface-700 mb-1">Quantity *</label>
						<input
							id="itemQuantity"
							type="number"
							step="1"
							min="1"
							class="input"
							bind:value={itemForm.quantity}
							required
						/>
					</div>
					<div>
						<label for="itemUnitPrice" class="block text-sm font-medium text-surface-700 mb-1">Unit Price *</label>
						<input
							id="itemUnitPrice"
							type="number"
							step="0.01"
							min="0"
							class="input"
							bind:value={itemForm.unitPrice}
							required
						/>
					</div>
				</div>
				<div>
					<label for="itemTaxRate" class="block text-sm font-medium text-surface-700 mb-1">Tax Rate (%)</label>
					<input
						id="itemTaxRate"
						type="number"
						step="0.01"
						min="0"
						max="100"
						class="input"
						bind:value={itemForm.taxRate}
					/>
				</div>
				<div class="pt-2 border-t border-surface-100">
					<div class="flex justify-between text-sm">
						<span class="text-surface-500">Line Total:</span>
						<span class="font-medium text-surface-900">
							{formatCurrency((Number(itemForm.quantity) || 0) * (Number(itemForm.unitPrice) || 0) * (1 + (Number(itemForm.taxRate) || 0) / 100))}
						</span>
					</div>
				</div>
				<div class="flex justify-end gap-3 pt-4">
					<button type="button" class="btn btn-secondary" onclick={() => (showAddItemModal = false)}>
						Cancel
					</button>
					<button type="submit" class="btn btn-primary" disabled={saving}>
						{saving ? 'Saving...' : (editingItemId ? 'Update Item' : 'Add Item')}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<ConfirmDeleteModal
	bind:open={showDeleteItemModal}
	title="Remove Line Item"
	message="Are you sure you want to remove"
	itemName={itemToDelete?.description || 'this item'}
	onConfirm={removeItem}
/>
