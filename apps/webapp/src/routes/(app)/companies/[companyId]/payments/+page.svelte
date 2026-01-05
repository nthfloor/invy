<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { paymentsApi, type Payment } from '$lib/api/client';

	let companyId = $derived($page.params.companyId);

	let payments = $state<Payment[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let showRecordModal = $state(false);

	let formData = $state({
		invoiceId: '',
		amount: 0,
		paymentDate: new Date().toISOString().split('T')[0],
		paymentMethod: 'bank_transfer',
		reference: '',
		notes: ''
	});

	onMount(async () => {
		await loadPayments();
	});

	async function loadPayments() {
		loading = true;
		error = null;
		try {
			const result = await paymentsApi.list(companyId);
			payments = result.data;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load payments';
			// Demo data
			payments = [
				{
					id: 'pay-1',
					companyId,
					invoiceId: 'inv-2',
					amount: 27600,
					currency: 'ZAR',
					paymentDate: '2025-01-03',
					paymentMethod: 'bank_transfer',
					reference: 'REF-20250103-001',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				},
				{
					id: 'pay-2',
					companyId,
					invoiceId: 'inv-1',
					amount: 10000,
					currency: 'ZAR',
					paymentDate: '2025-01-02',
					paymentMethod: 'card',
					reference: 'CARD-20250102-001',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				}
			];
			error = null;
		} finally {
			loading = false;
		}
	}

	async function recordPayment() {
		try {
			const newPayment = await paymentsApi.create(companyId, formData);
			payments = [newPayment, ...payments];
			showRecordModal = false;
			formData = {
				invoiceId: '',
				amount: 0,
				paymentDate: new Date().toISOString().split('T')[0],
				paymentMethod: 'bank_transfer',
				reference: '',
				notes: ''
			};
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to record payment';
		}
	}

	function formatCurrency(amount: number, currency: string) {
		return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(amount);
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
			<h1 class="text-2xl font-semibold text-surface-900">Payments</h1>
			<p class="text-surface-500 mt-1">Track and record payments</p>
		</div>
		<button class="btn btn-primary" onclick={() => (showRecordModal = true)}>
			<span class="material-icons text-sm">add</span>
			Record Payment
		</button>
	</div>

	<!-- Summary Card -->
	<div class="card p-5 mb-6">
		<div class="flex items-center justify-between">
			<div>
				<p class="text-sm text-surface-500">Total Received</p>
				<p class="text-3xl font-semibold text-green-600">{formatCurrency(totalReceived, 'ZAR')}</p>
			</div>
			<div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
				<span class="material-icons text-3xl text-green-600">payments</span>
			</div>
		</div>
	</div>

	{#if error}
		<div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="text-surface-500">Loading payments...</div>
		</div>
	{:else if payments.length === 0}
		<div class="card p-8 text-center">
			<div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
				<span class="material-icons text-3xl text-surface-400">payments</span>
			</div>
			<h3 class="text-lg font-medium text-surface-900 mb-2">No payments yet</h3>
			<p class="text-surface-500 mb-4">Record your first payment to get started</p>
			<button class="btn btn-primary" onclick={() => (showRecordModal = true)}>
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
						<th>Reference</th>
						<th>Method</th>
						<th>Amount</th>
						<th>Notes</th>
					</tr>
				</thead>
				<tbody>
					{#each payments as payment}
						<tr>
							<td class="text-surface-600">{formatDate(payment.paymentDate)}</td>
							<td class="font-medium text-surface-900">{payment.reference || '-'}</td>
							<td>
								<span class="badge bg-surface-200 text-surface-600">
									{getMethodLabel(payment.paymentMethod)}
								</span>
							</td>
							<td class="font-medium text-green-600">
								{formatCurrency(payment.amount, payment.currency)}
							</td>
							<td class="text-surface-500 max-w-xs truncate">{payment.notes || '-'}</td>
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
					<label for="amount" class="block text-sm font-medium text-surface-700 mb-1">Amount *</label>
					<input id="amount" type="number" step="0.01" class="input" bind:value={formData.amount} required />
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
					<input id="reference" type="text" class="input" bind:value={formData.reference} />
				</div>
				<div>
					<label for="notes" class="block text-sm font-medium text-surface-700 mb-1">Notes</label>
					<textarea id="notes" class="input" rows="2" bind:value={formData.notes}></textarea>
				</div>
				<div class="flex justify-end gap-3 pt-4">
					<button type="button" class="btn btn-secondary" onclick={() => (showRecordModal = false)}>Cancel</button>
					<button type="submit" class="btn btn-primary">Record Payment</button>
				</div>
			</form>
		</div>
	</div>
{/if}
