<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { invoicesApi, type Invoice } from '$lib/api/client';

	let companyId = $derived($page.params.companyId);

	let invoices = $state<Invoice[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let statusFilter = $state('');
	let showCreateModal = $state(false);

	onMount(async () => {
		await loadInvoices();
	});

	async function loadInvoices() {
		loading = true;
		error = null;
		try {
			const result = await invoicesApi.list(companyId, { status: statusFilter || undefined });
			invoices = result.data;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load invoices';
			// Demo data
			invoices = [
				{
					id: 'inv-1',
					companyId,
					clientId: 'client-1',
					invoiceNumber: 'INV-2025-001',
					status: 'sent',
					issueDate: '2025-01-01',
					dueDate: '2025-01-31',
					subtotal: 15000,
					taxAmount: 2250,
					total: 17250,
					currency: 'ZAR',
					lineItems: [],
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				},
				{
					id: 'inv-2',
					companyId,
					clientId: 'client-2',
					invoiceNumber: 'INV-2025-002',
					status: 'paid',
					issueDate: '2025-01-03',
					dueDate: '2025-02-03',
					subtotal: 24000,
					taxAmount: 3600,
					total: 27600,
					currency: 'ZAR',
					lineItems: [],
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				},
				{
					id: 'inv-3',
					companyId,
					clientId: 'client-1',
					invoiceNumber: 'INV-2024-045',
					status: 'overdue',
					issueDate: '2024-12-01',
					dueDate: '2024-12-31',
					subtotal: 8500,
					taxAmount: 1275,
					total: 9775,
					currency: 'ZAR',
					lineItems: [],
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				}
			];
			error = null;
		} finally {
			loading = false;
		}
	}

	async function sendInvoice(invoice: Invoice) {
		if (!confirm(`Send invoice ${invoice.invoiceNumber} to client?`)) return;
		try {
			await invoicesApi.send(companyId, invoice.id);
			invoices = invoices.map((i) => (i.id === invoice.id ? { ...i, status: 'sent' } : i));
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to send invoice';
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
			case 'cancelled':
				return 'bg-surface-200 text-surface-500';
			default:
				return 'bg-surface-200 text-surface-600';
		}
	}

	const filteredInvoices = $derived(
		statusFilter ? invoices.filter((i) => i.status === statusFilter) : invoices
	);

	const stats = $derived({
		total: invoices.reduce((sum, i) => sum + i.total, 0),
		paid: invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.total, 0),
		pending: invoices
			.filter((i) => i.status === 'sent')
			.reduce((sum, i) => sum + i.total, 0),
		overdue: invoices.filter((i) => i.status === 'overdue').reduce((sum, i) => sum + i.total, 0)
	});
</script>

<div class="p-6">
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
		<div>
			<h1 class="text-2xl font-semibold text-surface-900">Invoices</h1>
			<p class="text-surface-500 mt-1">Create and manage invoices</p>
		</div>
		<button class="btn btn-primary" onclick={() => (showCreateModal = true)}>
			<span class="material-icons text-sm">add</span>
			New Invoice
		</button>
	</div>

	<!-- Stats -->
	<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
		<div class="card p-4">
			<p class="text-sm text-surface-500">Total</p>
			<p class="text-xl font-semibold text-surface-900">{formatCurrency(stats.total, 'ZAR')}</p>
		</div>
		<div class="card p-4">
			<p class="text-sm text-surface-500">Paid</p>
			<p class="text-xl font-semibold text-green-600">{formatCurrency(stats.paid, 'ZAR')}</p>
		</div>
		<div class="card p-4">
			<p class="text-sm text-surface-500">Pending</p>
			<p class="text-xl font-semibold text-blue-600">{formatCurrency(stats.pending, 'ZAR')}</p>
		</div>
		<div class="card p-4">
			<p class="text-sm text-surface-500">Overdue</p>
			<p class="text-xl font-semibold text-red-600">{formatCurrency(stats.overdue, 'ZAR')}</p>
		</div>
	</div>

	<!-- Filters -->
	<div class="mb-6 flex gap-2">
		<button
			class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors {!statusFilter
				? 'bg-primary-600 text-white'
				: 'bg-surface-200 text-surface-600 hover:bg-surface-300'}"
			onclick={() => (statusFilter = '')}
		>
			All
		</button>
		{#each ['draft', 'sent', 'paid', 'overdue'] as status}
			<button
				class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize {statusFilter ===
				status
					? 'bg-primary-600 text-white'
					: 'bg-surface-200 text-surface-600 hover:bg-surface-300'}"
				onclick={() => (statusFilter = status)}
			>
				{status}
			</button>
		{/each}
	</div>

	{#if error}
		<div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="text-surface-500">Loading invoices...</div>
		</div>
	{:else if filteredInvoices.length === 0}
		<div class="card p-8 text-center">
			<div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
				<span class="material-icons text-3xl text-surface-400">receipt_long</span>
			</div>
			<h3 class="text-lg font-medium text-surface-900 mb-2">No invoices</h3>
			<p class="text-surface-500 mb-4">Create your first invoice to get started</p>
			<button class="btn btn-primary" onclick={() => (showCreateModal = true)}>
				<span class="material-icons text-sm">add</span>
				New Invoice
			</button>
		</div>
	{:else}
		<div class="card overflow-hidden">
			<table class="table">
				<thead>
					<tr>
						<th>Invoice #</th>
						<th>Issue Date</th>
						<th>Due Date</th>
						<th>Amount</th>
						<th>Status</th>
						<th class="w-20">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredInvoices as invoice}
						<tr>
							<td class="font-medium text-surface-900">{invoice.invoiceNumber}</td>
							<td class="text-surface-600">{formatDate(invoice.issueDate)}</td>
							<td class="text-surface-600">{formatDate(invoice.dueDate)}</td>
							<td class="font-medium text-surface-900">
								{formatCurrency(invoice.total, invoice.currency)}
							</td>
							<td>
								<span class="badge {getStatusClass(invoice.status)} capitalize">
									{invoice.status}
								</span>
							</td>
							<td>
								<div class="flex items-center gap-1">
									{#if invoice.status === 'draft'}
										<button
											class="p-1 hover:bg-surface-100 rounded"
											onclick={() => sendInvoice(invoice)}
											title="Send"
										>
											<span class="material-icons text-lg text-primary-600">send</span>
										</button>
									{/if}
									<button class="p-1 hover:bg-surface-100 rounded" title="View">
										<span class="material-icons text-lg text-surface-500">visibility</span>
									</button>
									<button class="p-1 hover:bg-surface-100 rounded" title="Download">
										<span class="material-icons text-lg text-surface-500">download</span>
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

{#if showCreateModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
		<div class="card w-full max-w-2xl mx-4 max-h-[90vh] overflow-auto">
			<div class="p-4 border-b border-surface-200 flex justify-between items-center">
				<h2 class="text-lg font-medium text-surface-900">New Invoice</h2>
				<button class="text-surface-400 hover:text-surface-600" onclick={() => (showCreateModal = false)}>
					<span class="material-icons">close</span>
				</button>
			</div>
			<div class="p-4">
				<p class="text-surface-500">Invoice creation form would go here.</p>
				<p class="text-surface-400 text-sm mt-2">
					This would include client selection, line items, dates, and notes.
				</p>
				<div class="flex justify-end gap-3 pt-6">
					<button class="btn btn-secondary" onclick={() => (showCreateModal = false)}>Cancel</button>
					<button class="btn btn-primary">Create Invoice</button>
				</div>
			</div>
		</div>
	</div>
{/if}
