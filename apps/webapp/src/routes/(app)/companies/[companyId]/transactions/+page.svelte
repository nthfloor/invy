<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { paymentsApi, invoicesApi, type Payment, type Invoice } from '$lib/api/client';

	let companyId = $derived($page.params.companyId);

	let payments = $state<Payment[]>([]);
	let unpaidInvoices = $state<Invoice[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let showRecordModal = $state(false);
	let recording = $state(false);

	let formData = $state({
		invoiceId: '',
		amount: 0,
		paymentDate: new Date().toISOString().split('T')[0],
		paymentMethod: 'bank_transfer',
		reference: '',
		notes: ''
	});

	// Get selected invoice balance
	const selectedInvoice = $derived(unpaidInvoices.find((i) => i.id === formData.invoiceId));

	onMount(async () => {
		await Promise.all([loadPayments(), loadUnpaidInvoices()]);
	});

	async function loadUnpaidInvoices() {
		if (!companyId) return;
		try {
			const result = await invoicesApi.list(companyId);
			unpaidInvoices = result.data.filter(
				(i) => i.status !== 'paid' && i.status !== 'cancelled' && i.balance > 0
			);
		} catch {
			unpaidInvoices = [];
		}
	}

	async function loadPayments() {
		if (!companyId) return;
		loading = true;
		error = null;
		try {
			const result = await paymentsApi.list(companyId);
			payments = result.data;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load transactions';
		} finally {
			loading = false;
		}
	}

	function openRecordModal() {
		formData = {
			invoiceId: '',
			amount: 0,
			paymentDate: new Date().toISOString().split('T')[0],
			paymentMethod: 'bank_transfer',
			reference: '',
			notes: ''
		};
		showRecordModal = true;
	}

	function onInvoiceSelect(invoiceId: string) {
		formData.invoiceId = invoiceId;
		const invoice = unpaidInvoices.find((i) => i.id === invoiceId);
		if (invoice) {
			formData.amount = invoice.balance;
		}
	}

	async function recordPayment() {
		if (!companyId) return;
		if (!formData.invoiceId) {
			error = 'Please select an invoice';
			return;
		}
		recording = true;
		error = null;
		try {
			const newPayment = await paymentsApi.create({
				companyId,
				invoiceId: formData.invoiceId,
				amount: formData.amount,
				paymentDate: formData.paymentDate,
				paymentMethod: formData.paymentMethod,
				reference: formData.reference || undefined,
				notes: formData.notes || undefined
			});
			payments = [newPayment, ...payments];
			showRecordModal = false;
			// Reload unpaid invoices to update balances
			await loadUnpaidInvoices();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to record payment';
		} finally {
			recording = false;
		}
	}

	function viewInvoice(invoiceId: string) {
		goto(`/companies/${companyId}/invoices/${invoiceId}`);
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

	const totalReceived = $derived(payments.reduce((sum, p) => sum + p.amount, 0));
</script>

<div class="p-6">
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
		<div>
			<h1 class="text-2xl font-semibold text-surface-900">Transactions</h1>
			<p class="text-surface-500 mt-1">View and record payment transactions</p>
		</div>
		<button class="btn btn-primary" onclick={openRecordModal}>
			<span class="material-icons text-sm">add</span>
			Record Payment
		</button>
	</div>

	<!-- Summary Card -->
	<div class="card p-5 mb-6">
		<div class="flex items-center justify-between">
			<div>
				<p class="text-sm text-surface-500">Total Received</p>
				<p class="text-3xl font-semibold text-green-600">{formatCurrency(totalReceived)}</p>
			</div>
			<div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
				<span class="material-icons text-3xl text-green-600">account_balance</span>
			</div>
		</div>
	</div>

	{#if error}
		<div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="text-surface-500">Loading transactions...</div>
		</div>
	{:else if payments.length === 0}
		<div class="card p-8 text-center">
			<div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
				<span class="material-icons text-3xl text-surface-400">account_balance</span>
			</div>
			<h3 class="text-lg font-medium text-surface-900 mb-2">No transactions yet</h3>
			<p class="text-surface-500 mb-4">Record your first payment to get started</p>
			<button class="btn btn-primary" onclick={openRecordModal}>
				<span class="material-icons text-sm">add</span>
				Record Payment
			</button>
		</div>
	{:else}
		<div class="card overflow-hidden">
			<table class="table">
				<thead>
					<tr>
						<th>Date</th>
						<th>Payment #</th>
						<th>Invoice</th>
						<th>Method</th>
						<th>Amount</th>
						<th>Status</th>
						<th class="w-16">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each payments as payment}
						<tr>
							<td class="text-surface-600">{formatDate(payment.paymentDate)}</td>
							<td class="font-medium text-surface-900">{payment.paymentNumber || payment.reference || '-'}</td>
							<td>
								<button
									class="text-primary-600 hover:text-primary-700 hover:underline"
									onclick={() => viewInvoice(payment.invoiceId)}
								>
									View Invoice
								</button>
							</td>
							<td>
								<span class="badge bg-surface-200 text-surface-600">
									{getMethodLabel(payment.paymentMethod)}
								</span>
							</td>
							<td class="font-medium text-green-600">
								{formatCurrency(payment.amount)}
							</td>
							<td>
								<span class="badge bg-green-100 text-green-700 capitalize">
									{payment.status}
								</span>
							</td>
							<td>
								<button
									class="p-1 hover:bg-surface-100 rounded"
									title="View Invoice"
									onclick={() => viewInvoice(payment.invoiceId)}
								>
									<span class="material-icons text-lg text-surface-500">visibility</span>
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

{#if showRecordModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
		<div class="card w-full max-w-md mx-4">
			<div class="p-4 border-b border-surface-200 flex justify-between items-center">
				<h2 class="text-lg font-medium text-surface-900">Record Payment</h2>
				<button class="text-surface-400 hover:text-surface-600" onclick={() => (showRecordModal = false)}>
					<span class="material-icons">close</span>
				</button>
			</div>
			<form class="p-4 space-y-4" onsubmit={(e) => { e.preventDefault(); recordPayment(); }}>
				<div>
					<label for="invoiceId" class="block text-sm font-medium text-surface-700 mb-1">Invoice *</label>
					<select
						id="invoiceId"
						class="input"
						value={formData.invoiceId}
						onchange={(e) => onInvoiceSelect((e.target as HTMLSelectElement).value)}
						required
					>
						<option value="">Select an invoice</option>
						{#each unpaidInvoices as invoice}
							<option value={invoice.id}>
								{invoice.invoiceNumber} - {formatCurrency(invoice.balance)} due
							</option>
						{/each}
					</select>
					{#if unpaidInvoices.length === 0}
						<p class="text-xs text-surface-500 mt-1">No unpaid invoices available</p>
					{/if}
				</div>
				<div>
					<label for="amount" class="block text-sm font-medium text-surface-700 mb-1">Amount *</label>
					<input
						id="amount"
						type="number"
						step="0.01"
						min="0.01"
						max={selectedInvoice?.balance || undefined}
						class="input"
						bind:value={formData.amount}
						required
					/>
					{#if selectedInvoice}
						<p class="text-xs text-surface-500 mt-1">Balance due: {formatCurrency(selectedInvoice.balance)}</p>
					{/if}
				</div>
				<div>
					<label for="paymentDate" class="block text-sm font-medium text-surface-700 mb-1">Payment Date *</label>
					<input id="paymentDate" type="date" class="input" bind:value={formData.paymentDate} required />
				</div>
				<div>
					<label for="paymentMethod" class="block text-sm font-medium text-surface-700 mb-1">Payment Method *</label>
					<select id="paymentMethod" class="input" bind:value={formData.paymentMethod} required>
						<option value="bank_transfer">Bank Transfer</option>
						<option value="eft">EFT</option>
						<option value="card">Card</option>
						<option value="cash">Cash</option>
						<option value="other">Other</option>
					</select>
				</div>
				<div>
					<label for="reference" class="block text-sm font-medium text-surface-700 mb-1">Reference</label>
					<input id="reference" type="text" class="input" bind:value={formData.reference} placeholder="Transaction reference" />
				</div>
				<div>
					<label for="notes" class="block text-sm font-medium text-surface-700 mb-1">Notes</label>
					<textarea id="notes" class="input" rows="2" bind:value={formData.notes}></textarea>
				</div>
				<div class="flex justify-end gap-3 pt-4">
					<button type="button" class="btn btn-secondary" onclick={() => (showRecordModal = false)}>Cancel</button>
					<button type="submit" class="btn btn-primary" disabled={recording || !formData.invoiceId}>
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
