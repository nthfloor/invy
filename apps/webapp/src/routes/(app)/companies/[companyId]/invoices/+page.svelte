<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { invoicesApi, type Invoice } from '$lib/api/client';
	import ErrorState from '$lib/components/ErrorState.svelte';

	let companyId = $derived($page.params.companyId);

	let invoices = $state<Invoice[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let statusFilter = $state('');

	onMount(async () => {
		await loadInvoices();
	});

	async function loadInvoices() {
		if (!companyId) return;
		loading = true;
		error = null;
		try {
			const result = await invoicesApi.list(companyId, { status: statusFilter || undefined });
			invoices = result.data;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load invoices';
		} finally {
			loading = false;
		}
	}

	async function sendInvoice(invoice: Invoice) {
		if (!confirm(`Send invoice ${invoice.invoiceNumber} to client?`)) return;
		if (!companyId) return;
		try {
			await invoicesApi.markAsSent(invoice.id, companyId);
			invoices = invoices.map((i) => (i.id === invoice.id ? { ...i, status: 'sent' } : i));
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to send invoice';
		}
	}

	function viewInvoice(invoice: Invoice) {
		goto(`/companies/${companyId}/invoices/${invoice.id}`);
	}

	function downloadInvoice(invoice: Invoice) {
		if (!companyId) return;
		const url = invoicesApi.getPdfUrl(invoice.id, companyId, true);
		window.open(url, '_blank');
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
		<button class="btn btn-primary" onclick={() => goto(`/companies/${companyId}/invoices/new`)}>
			<span class="material-icons text-sm">add</span>
			New Invoice
		</button>
	</div>

	<!-- Stats -->
	<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
		<div class="card p-4">
			<p class="text-sm text-surface-500">Total</p>
			<p class="text-xl font-semibold text-surface-900">{formatCurrency(stats.total)}</p>
		</div>
		<div class="card p-4">
			<p class="text-sm text-surface-500">Paid</p>
			<p class="text-xl font-semibold text-green-600">{formatCurrency(stats.paid)}</p>
		</div>
		<div class="card p-4">
			<p class="text-sm text-surface-500">Pending</p>
			<p class="text-xl font-semibold text-blue-600">{formatCurrency(stats.pending)}</p>
		</div>
		<div class="card p-4">
			<p class="text-sm text-surface-500">Overdue</p>
			<p class="text-xl font-semibold text-red-600">{formatCurrency(stats.overdue)}</p>
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

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="text-surface-500">Loading invoices...</div>
		</div>
	{:else if error && invoices.length === 0}
		<ErrorState
			title="Unable to Load Invoices"
			message={error}
			onRetry={loadInvoices}
		/>
	{:else if filteredInvoices.length === 0}
		<div class="card p-8 text-center">
			<div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
				<span class="material-icons text-3xl text-surface-400">receipt_long</span>
			</div>
			<h3 class="text-lg font-medium text-surface-900 mb-2">No invoices</h3>
			<p class="text-surface-500 mb-4">Create your first invoice to get started</p>
			<button class="btn btn-primary" onclick={() => goto(`/companies/${companyId}/invoices/new`)}>
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
						<tr class="cursor-pointer hover:bg-surface-50" onclick={() => viewInvoice(invoice)}>
							<td class="font-medium text-surface-900">{invoice.invoiceNumber}</td>
							<td class="text-surface-600">{formatDate(invoice.issueDate)}</td>
							<td class="text-surface-600">{formatDate(invoice.dueDate)}</td>
							<td class="font-medium text-surface-900">
								{formatCurrency(invoice.total)}
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
											onclick={(e) => { e.stopPropagation(); sendInvoice(invoice); }}
											title="Send"
										>
											<span class="material-icons text-lg text-primary-600">send</span>
										</button>
									{/if}
									<button
										class="p-1 hover:bg-surface-100 rounded"
										title="View"
										onclick={(e) => { e.stopPropagation(); viewInvoice(invoice); }}
									>
										<span class="material-icons text-lg text-surface-500">visibility</span>
									</button>
									<button
										class="p-1 hover:bg-surface-100 rounded"
										title="Download"
										onclick={(e) => { e.stopPropagation(); downloadInvoice(invoice); }}
									>
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
