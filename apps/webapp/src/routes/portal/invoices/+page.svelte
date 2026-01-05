<script lang="ts">
	import type { Invoice } from '$lib/api/client';

	// Mock data - will come from portal API
	const invoices: Invoice[] = [
		{
			id: 'inv-1',
			companyId: 'company-1',
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
			createdOn: new Date().toISOString(),
			updatedOn: new Date().toISOString()
		},
		{
			id: 'inv-2',
			companyId: 'company-1',
			clientId: 'client-1',
			invoiceNumber: 'INV-2024-045',
			status: 'paid',
			issueDate: '2024-12-01',
			dueDate: '2024-12-31',
			subtotal: 8500,
			taxTotal: 1275,
			total: 9775,
			amountPaid: 9775,
			balance: 0,
			createdOn: new Date().toISOString(),
			updatedOn: new Date().toISOString()
		}
	];

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
			default:
				return 'bg-surface-200 text-surface-600';
		}
	}

	const outstanding = invoices
		.filter((i) => i.status !== 'paid')
		.reduce((sum, i) => sum + i.total, 0);
</script>

<div>
	<!-- Summary Card -->
	<div class="card p-5 mb-6 flex items-center justify-between">
		<div>
			<p class="text-sm text-surface-500">Outstanding Balance</p>
			<p class="text-3xl font-semibold text-surface-900">{formatCurrency(outstanding)}</p>
		</div>
		<button class="btn btn-primary">
			<span class="material-icons text-sm">payment</span>
			Pay Now
		</button>
	</div>

	<h1 class="text-xl font-semibold text-surface-900 mb-4">Your Invoices</h1>

	{#if invoices.length === 0}
		<div class="card p-8 text-center">
			<div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
				<span class="material-icons text-3xl text-surface-400">receipt_long</span>
			</div>
			<h3 class="text-lg font-medium text-surface-900 mb-2">No invoices</h3>
			<p class="text-surface-500">You don't have any invoices yet.</p>
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
						<th class="w-32">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each invoices as invoice}
						<tr>
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
								<div class="flex items-center gap-2">
									<button class="btn btn-secondary text-sm px-3 py-1">
										<span class="material-icons text-sm">visibility</span>
										View
									</button>
									<button class="btn btn-secondary text-sm px-3 py-1">
										<span class="material-icons text-sm">download</span>
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
