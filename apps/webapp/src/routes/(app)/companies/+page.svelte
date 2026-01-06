<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { companiesApi, type Company } from '$lib/api/client';
	import { auth } from '$lib/stores/auth';
	import ErrorState from '$lib/components/ErrorState.svelte';

	let companies = $state<Company[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		await loadCompanies();
	});

	async function loadCompanies() {
		loading = true;
		error = null;
		try {
			const result = await companiesApi.list();
			companies = result.data;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load companies';
		} finally {
			loading = false;
		}
	}

	function selectCompany(company: Company) {
		auth.setCompany(company.id);
		goto(`/companies/${company.id}`);
	}
</script>

<div class="p-6">
	<!-- Header -->
	<div class="flex justify-between items-center mb-6">
		<div>
			<h1 class="text-2xl font-semibold text-surface-900">Companies</h1>
			<p class="text-surface-500 mt-1">Manage your companies and their settings</p>
		</div>
		<button class="btn btn-primary" onclick={() => goto('/companies/new')}>
			<span class="material-icons text-sm">add</span>
			New Company
		</button>
	</div>

	<!-- Loading State -->
	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="text-surface-500">Loading companies...</div>
		</div>
	{:else if error}
		<ErrorState
			title="Unable to Load Companies"
			message={error}
			onRetry={loadCompanies}
		/>
	{:else if companies.length === 0}
		<!-- Empty State -->
		<div class="card p-8 text-center">
			<div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
				<span class="material-icons text-3xl text-surface-400">business</span>
			</div>
			<h3 class="text-lg font-medium text-surface-900 mb-2">No companies yet</h3>
			<p class="text-surface-500 mb-4">Create your first company to start invoicing</p>
			<button class="btn btn-primary" onclick={() => goto('/companies/new')}>
				<span class="material-icons text-sm">add</span>
				Create Company
			</button>
		</div>
	{:else}
		<!-- Companies Grid -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each companies as company}
				<button
					class="card p-5 text-left hover:shadow-md transition-shadow cursor-pointer"
					onclick={() => selectCompany(company)}
				>
					<div class="flex items-start gap-4">
						<div
							class="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center text-primary-700"
						>
							<span class="material-icons">business</span>
						</div>
						<div class="flex-1 min-w-0">
							<h3 class="font-medium text-surface-900 truncate">{company.name}</h3>
							<p class="text-sm text-surface-500 truncate">{company.email}</p>
							{#if company.phone}
								<p class="text-sm text-surface-400 mt-1">{company.phone}</p>
							{/if}
						</div>
					</div>
					<div class="mt-4 pt-4 border-t border-surface-100 flex justify-between text-sm">
						<span class="badge {company.isActive ? 'badge-success' : 'badge-error'}">
							{company.isActive ? 'Active' : 'Inactive'}
						</span>
						<span class="text-surface-400">
							{new Date(company.createdOn).toLocaleDateString()}
						</span>
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>
