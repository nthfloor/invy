<script lang="ts">
	// Mock statement data
	const statements = [
		{
			id: 'stmt-1',
			period: 'January 2025',
			generatedAt: '2025-01-04',
			openingBalance: 0,
			invoiced: 17250,
			payments: 0,
			closingBalance: 17250
		},
		{
			id: 'stmt-2',
			period: 'December 2024',
			generatedAt: '2025-01-01',
			openingBalance: 9775,
			invoiced: 0,
			payments: 9775,
			closingBalance: 0
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
</script>

<div>
	<h1 class="text-xl font-semibold text-surface-900 mb-4">Account Statements</h1>

	{#if statements.length === 0}
		<div class="card p-8 text-center">
			<div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
				<span class="material-icons text-3xl text-surface-400">description</span>
			</div>
			<h3 class="text-lg font-medium text-surface-900 mb-2">No statements</h3>
			<p class="text-surface-500">You don't have any statements yet.</p>
		</div>
	{:else}
		<div class="grid gap-4">
			{#each statements as statement}
				<div class="card p-5">
					<div class="flex items-start justify-between mb-4">
						<div>
							<h3 class="font-medium text-surface-900">{statement.period}</h3>
							<p class="text-sm text-surface-500">Generated {formatDate(statement.generatedAt)}</p>
						</div>
						<button class="btn btn-secondary text-sm">
							<span class="material-icons text-sm">download</span>
							Download PDF
						</button>
					</div>

					<div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-surface-100">
						<div>
							<p class="text-xs text-surface-400 uppercase">Opening Balance</p>
							<p class="text-lg font-medium text-surface-700">
								{formatCurrency(statement.openingBalance)}
							</p>
						</div>
						<div>
							<p class="text-xs text-surface-400 uppercase">Invoiced</p>
							<p class="text-lg font-medium text-surface-700">
								{formatCurrency(statement.invoiced)}
							</p>
						</div>
						<div>
							<p class="text-xs text-surface-400 uppercase">Payments</p>
							<p class="text-lg font-medium text-green-600">
								-{formatCurrency(statement.payments)}
							</p>
						</div>
						<div>
							<p class="text-xs text-surface-400 uppercase">Closing Balance</p>
							<p class="text-lg font-semibold {statement.closingBalance > 0 ? 'text-red-600' : 'text-green-600'}">
								{formatCurrency(statement.closingBalance)}
							</p>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
