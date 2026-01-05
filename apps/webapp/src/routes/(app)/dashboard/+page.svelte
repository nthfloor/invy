<script lang="ts">
	import { user } from '$lib/stores/auth';

	// Mock stats for now - will be fetched from API
	const stats = [
		{ label: 'Total Revenue', value: 'R 125,430', change: '+12%', positive: true },
		{ label: 'Pending Invoices', value: '23', change: 'R 45,200', positive: false },
		{ label: 'Active Clients', value: '156', change: '+8 this month', positive: true },
		{ label: 'Overdue', value: '5', change: 'R 12,500', positive: false }
	];
</script>

<div class="p-6">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-2xl font-semibold text-surface-900">
			Welcome back{$user ? `, ${$user.name}` : ''}
		</h1>
		<p class="text-surface-500 mt-1">Here's what's happening with your business today.</p>
	</div>

	<!-- Stats Grid -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
		{#each stats as stat}
			<div class="card p-5">
				<p class="text-sm text-surface-500">{stat.label}</p>
				<p class="text-2xl font-semibold text-surface-900 mt-1">{stat.value}</p>
				<p
					class="text-sm mt-2 {stat.positive
						? 'text-green-600'
						: stat.label === 'Overdue'
							? 'text-red-600'
							: 'text-surface-500'}"
				>
					{stat.change}
				</p>
			</div>
		{/each}
	</div>

	<!-- Quick Actions -->
	<div class="card p-5 mb-8">
		<h2 class="text-lg font-medium text-surface-900 mb-4">Quick Actions</h2>
		<div class="flex flex-wrap gap-3">
			<a href="/companies" class="btn btn-primary">
				<span class="material-icons text-sm">add</span>
				New Invoice
			</a>
			<a href="/companies" class="btn btn-secondary">
				<span class="material-icons text-sm">person_add</span>
				Add Client
			</a>
			<a href="/companies" class="btn btn-secondary">
				<span class="material-icons text-sm">payments</span>
				Record Payment
			</a>
		</div>
	</div>

	<!-- Recent Activity -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- Recent Invoices -->
		<div class="card">
			<div class="p-4 border-b border-surface-200 flex justify-between items-center">
				<h2 class="font-medium text-surface-900">Recent Invoices</h2>
				<a href="/companies" class="text-sm text-primary-600 hover:underline">View all</a>
			</div>
			<div class="p-4">
				<p class="text-surface-500 text-sm">Select a company to view invoices</p>
			</div>
		</div>

		<!-- Recent Payments -->
		<div class="card">
			<div class="p-4 border-b border-surface-200 flex justify-between items-center">
				<h2 class="font-medium text-surface-900">Recent Payments</h2>
				<a href="/companies" class="text-sm text-primary-600 hover:underline">View all</a>
			</div>
			<div class="p-4">
				<p class="text-surface-500 text-sm">Select a company to view payments</p>
			</div>
		</div>
	</div>
</div>
