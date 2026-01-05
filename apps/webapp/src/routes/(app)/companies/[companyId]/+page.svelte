<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		statsApi,
		invoicesApi,
		paymentsApi,
		companiesApi,
		type CompanyStats,
		type Invoice,
		type Payment,
		type Company
	} from '$lib/api/client';
	import { auth } from '$lib/stores/auth';

	let companyId = $derived($page.params.companyId);

	let company = $state<Company | null>(null);
	let stats = $state<CompanyStats | null>(null);
	let recentInvoices = $state<Invoice[]>([]);
	let recentPayments = $state<Payment[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Update the current company ID in the store
	$effect(() => {
		if (companyId) {
			auth.setCompany(companyId);
		}
	});

	onMount(async () => {
		await loadDashboardData();
	});

	async function loadDashboardData() {
		if (!companyId) return;
		loading = true;
		error = null;
		try {
			const [companyResult, statsResult, invoicesResult, paymentsResult] = await Promise.all([
				companiesApi.get(companyId),
				statsApi.getCompanyStats(companyId),
				invoicesApi.list(companyId, { perPage: 5 }),
				paymentsApi.list(companyId, { perPage: 5 })
			]);
			company = companyResult;
			stats = statsResult;
			recentInvoices = invoicesResult.data;
			recentPayments = paymentsResult.data;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load dashboard data';
		} finally {
			loading = false;
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
			case 'completed':
				return 'badge-success';
			case 'sent':
				return 'bg-blue-100 text-blue-700';
			case 'overdue':
			case 'failed':
				return 'badge-error';
			case 'draft':
			case 'pending':
				return 'bg-surface-200 text-surface-600';
			default:
				return 'bg-surface-200 text-surface-600';
		}
	}
</script>

<div class="p-6">
	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="text-surface-500">Loading dashboard...</div>
		</div>
	{:else if error}
		<div class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
	{:else}
		<!-- Header -->
		<div class="mb-6">
			<h1 class="text-2xl font-semibold text-surface-900">{company?.name || 'Dashboard'}</h1>
			<p class="text-surface-500 mt-1">Overview of your business performance</p>
		</div>

		<!-- Quick Actions -->
		<div class="flex gap-3 mb-6">
			<button
				class="btn btn-primary"
				onclick={() => goto(`/companies/${companyId}/invoices`)}
			>
				<span class="material-icons text-sm">add</span>
				New Invoice
			</button>
			<button
				class="btn btn-secondary"
				onclick={() => goto(`/companies/${companyId}/clients`)}
			>
				<span class="material-icons text-sm">person_add</span>
				Add Client
			</button>
			<button
				class="btn btn-secondary"
				onclick={() => goto(`/companies/${companyId}/products`)}
			>
				<span class="material-icons text-sm">inventory</span>
				Add Product
			</button>
		</div>

		<!-- Stats Grid -->
		{#if stats}
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
				<div class="card p-4">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
							<span class="material-icons text-green-600">trending_up</span>
						</div>
						<div>
							<p class="text-sm text-surface-500">Revenue</p>
							<p class="text-xl font-semibold text-surface-900">{formatCurrency(stats.invoices.totalRevenue)}</p>
						</div>
					</div>
				</div>
				<div class="card p-4">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
							<span class="material-icons text-blue-600">account_balance_wallet</span>
						</div>
						<div>
							<p class="text-sm text-surface-500">Outstanding</p>
							<p class="text-xl font-semibold text-surface-900">{formatCurrency(stats.invoices.totalOutstanding)}</p>
						</div>
					</div>
				</div>
				<div class="card p-4">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
							<span class="material-icons text-red-600">warning</span>
						</div>
						<div>
							<p class="text-sm text-surface-500">Overdue</p>
							<p class="text-xl font-semibold text-red-600">{formatCurrency(stats.invoices.totalOverdue)}</p>
						</div>
					</div>
				</div>
				<div class="card p-4">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
							<span class="material-icons text-purple-600">people</span>
						</div>
						<div>
							<p class="text-sm text-surface-500">Clients</p>
							<p class="text-xl font-semibold text-surface-900">{stats.totalClients}</p>
						</div>
					</div>
				</div>
			</div>

			<!-- Invoice Stats -->
			<div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
				<div class="card p-4 text-center">
					<p class="text-2xl font-bold text-surface-900">{stats.invoices.totalInvoices}</p>
					<p class="text-sm text-surface-500">Total Invoices</p>
				</div>
				<div class="card p-4 text-center">
					<p class="text-2xl font-bold text-surface-500">{stats.invoices.draftCount}</p>
					<p class="text-sm text-surface-500">Drafts</p>
				</div>
				<div class="card p-4 text-center">
					<p class="text-2xl font-bold text-blue-600">{stats.invoices.sentCount}</p>
					<p class="text-sm text-surface-500">Sent</p>
				</div>
				<div class="card p-4 text-center">
					<p class="text-2xl font-bold text-green-600">{stats.invoices.paidCount}</p>
					<p class="text-sm text-surface-500">Paid</p>
				</div>
				<div class="card p-4 text-center">
					<p class="text-2xl font-bold text-red-600">{stats.invoices.overdueCount}</p>
					<p class="text-sm text-surface-500">Overdue</p>
				</div>
			</div>
		{/if}

		<!-- Recent Activity -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Recent Invoices -->
			<div class="card">
				<div class="p-4 border-b border-surface-200 flex justify-between items-center">
					<h2 class="font-medium text-surface-900">Recent Invoices</h2>
					<a
						href="/companies/{companyId}/invoices"
						class="text-sm text-primary-600 hover:text-primary-700"
					>
						View All
					</a>
				</div>
				{#if recentInvoices.length === 0}
					<div class="p-8 text-center text-surface-500">
						<span class="material-icons text-3xl text-surface-300 mb-2">receipt_long</span>
						<p>No invoices yet</p>
					</div>
				{:else}
					<div class="divide-y divide-surface-200">
						{#each recentInvoices as invoice}
							<a
								href="/companies/{companyId}/invoices/{invoice.id}"
								class="p-4 flex items-center justify-between hover:bg-surface-50 transition-colors"
							>
								<div>
									<p class="font-medium text-surface-900">{invoice.invoiceNumber}</p>
									<p class="text-sm text-surface-500">{formatDate(invoice.issueDate)}</p>
								</div>
								<div class="text-right">
									<p class="font-medium text-surface-900">{formatCurrency(invoice.total)}</p>
									<span class="badge {getStatusClass(invoice.status)} capitalize text-xs">
										{invoice.status}
									</span>
								</div>
							</a>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Recent Payments -->
			<div class="card">
				<div class="p-4 border-b border-surface-200 flex justify-between items-center">
					<h2 class="font-medium text-surface-900">Recent Payments</h2>
					<a
						href="/companies/{companyId}/payments"
						class="text-sm text-primary-600 hover:text-primary-700"
					>
						View All
					</a>
				</div>
				{#if recentPayments.length === 0}
					<div class="p-8 text-center text-surface-500">
						<span class="material-icons text-3xl text-surface-300 mb-2">payments</span>
						<p>No payments yet</p>
					</div>
				{:else}
					<div class="divide-y divide-surface-200">
						{#each recentPayments as payment}
							<div class="p-4 flex items-center justify-between">
								<div>
									<p class="font-medium text-surface-900">{payment.paymentNumber}</p>
									<p class="text-sm text-surface-500">{formatDate(payment.paymentDate)}</p>
								</div>
								<div class="text-right">
									<p class="font-medium text-green-600">+{formatCurrency(payment.amount)}</p>
									<span class="badge {getStatusClass(payment.status)} capitalize text-xs">
										{payment.status}
									</span>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
