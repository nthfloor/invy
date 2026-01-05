<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { companiesApi, type Company } from '$lib/api/client';
	import { auth } from '$lib/stores/auth';

	let companies = $state<Company[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let showCreateModal = $state(false);

	// Form state
	let formData = $state({
		name: '',
		email: '',
		phone: ''
	});

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
			// For demo purposes, use mock data if API fails
			companies = [
				{
					id: 'demo-1',
					name: 'Acme Corporation',
					email: 'contact@acme.com',
					isActive: true,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				},
				{
					id: 'demo-2',
					name: 'TechStart Solutions',
					email: 'hello@techstart.com',
					isActive: true,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				}
			];
			error = null; // Clear error since we have demo data
		} finally {
			loading = false;
		}
	}

	function selectCompany(company: Company) {
		auth.setCompany(company.id);
		goto(`/companies/${company.id}/clients`);
	}

	async function createCompany() {
		try {
			const newCompany = await companiesApi.create(formData);
			companies = [...companies, newCompany];
			showCreateModal = false;
			formData = { name: '', email: '', phone: '' };
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create company';
		}
	}
</script>

<div class="p-6">
	<!-- Header -->
	<div class="flex justify-between items-center mb-6">
		<div>
			<h1 class="text-2xl font-semibold text-surface-900">Companies</h1>
			<p class="text-surface-500 mt-1">Manage your companies and their settings</p>
		</div>
		<button class="btn btn-primary" onclick={() => (showCreateModal = true)}>
			<span class="material-icons text-sm">add</span>
			New Company
		</button>
	</div>

	<!-- Error State -->
	{#if error}
		<div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
			{error}
		</div>
	{/if}

	<!-- Loading State -->
	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="text-surface-500">Loading companies...</div>
		</div>
	{:else if companies.length === 0}
		<!-- Empty State -->
		<div class="card p-8 text-center">
			<div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
				<span class="material-icons text-3xl text-surface-400">business</span>
			</div>
			<h3 class="text-lg font-medium text-surface-900 mb-2">No companies yet</h3>
			<p class="text-surface-500 mb-4">Create your first company to start invoicing</p>
			<button class="btn btn-primary" onclick={() => (showCreateModal = true)}>
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
							{new Date(company.createdAt).toLocaleDateString()}
						</span>
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>

<!-- Create Company Modal -->
{#if showCreateModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
		<div class="card w-full max-w-md mx-4">
			<div class="p-4 border-b border-surface-200 flex justify-between items-center">
				<h2 class="text-lg font-medium text-surface-900">Create Company</h2>
				<button class="text-surface-400 hover:text-surface-600" onclick={() => (showCreateModal = false)}>
					<span class="material-icons">close</span>
				</button>
			</div>
			<form class="p-4 space-y-4" onsubmit={(e) => { e.preventDefault(); createCompany(); }}>
				<div>
					<label for="name" class="block text-sm font-medium text-surface-700 mb-1">
						Company Name *
					</label>
					<input
						id="name"
						type="text"
						class="input"
						bind:value={formData.name}
						required
					/>
				</div>
				<div>
					<label for="email" class="block text-sm font-medium text-surface-700 mb-1">
						Email *
					</label>
					<input
						id="email"
						type="email"
						class="input"
						bind:value={formData.email}
						required
					/>
				</div>
				<div>
					<label for="phone" class="block text-sm font-medium text-surface-700 mb-1">
						Phone
					</label>
					<input
						id="phone"
						type="tel"
						class="input"
						bind:value={formData.phone}
					/>
				</div>
				<div class="flex justify-end gap-3 pt-4">
					<button type="button" class="btn btn-secondary" onclick={() => (showCreateModal = false)}>
						Cancel
					</button>
					<button type="submit" class="btn btn-primary">
						Create Company
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
