<script lang="ts">
	// Mock payment data
	const payments = [
		{
			id: 'pay-1',
			date: '2024-12-15',
			amount: 9775,
			method: 'Bank Transfer',
			reference: 'REF-20241215-001',
			invoiceNumber: 'INV-2024-045'
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

	const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
</script>

<div>
	<!-- Summary -->
	<div class="card p-5 mb-6">
		<div class="flex items-center justify-between">
			<div>
				<p class="text-sm text-surface-500">Total Payments Made</p>
				<p class="text-3xl font-semibold text-green-600">{formatCurrency(totalPaid)}</p>
			</div>
			<div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
				<span class="material-icons text-3xl text-green-600">check_circle</span>
			</div>
		</div>
	</div>

	<h1 class="text-xl font-semibold text-surface-900 mb-4">Payment History</h1>

	{#if payments.length === 0}
		<div class="card p-8 text-center">
			<div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
				<span class="material-icons text-3xl text-surface-400">payments</span>
			</div>
			<h3 class="text-lg font-medium text-surface-900 mb-2">No payments</h3>
			<p class="text-surface-500">You haven't made any payments yet.</p>
		</div>
	{:else}
		<div class="card overflow-hidden">
			<table class="table">
				<thead>
					<tr>
						<th>Date</th>
						<th>Reference</th>
						<th>Invoice</th>
						<th>Method</th>
						<th>Amount</th>
					</tr>
				</thead>
				<tbody>
					{#each payments as payment}
						<tr>
							<td class="text-surface-600">{formatDate(payment.date)}</td>
							<td class="font-medium text-surface-900">{payment.reference}</td>
							<td class="text-primary-600">{payment.invoiceNumber}</td>
							<td>
								<span class="badge bg-surface-200 text-surface-600">{payment.method}</span>
							</td>
							<td class="font-medium text-green-600">{formatCurrency(payment.amount)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
