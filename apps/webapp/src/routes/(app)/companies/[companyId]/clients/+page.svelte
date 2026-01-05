<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { clientsApi, type Client } from '$lib/api/client';
	import ConfirmDeleteModal from '$lib/components/ConfirmDeleteModal.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';

	let companyId = $derived($page.params.companyId);

	let clients = $state<Client[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let searchQuery = $state('');

	let showDeleteModal = $state(false);
	let clientToDelete = $state<Client | null>(null);

	onMount(async () => {
		await loadClients();
	});

	async function loadClients() {
		if (!companyId) return;
		loading = true;
		error = null;
		try {
			const result = await clientsApi.list(companyId, { search: searchQuery || undefined });
			clients = result.data;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load clients';
		} finally {
			loading = false;
		}
	}

	function openDeleteModal(client: Client) {
		clientToDelete = client;
		showDeleteModal = true;
	}

	async function deleteClient() {
		if (!companyId || !clientToDelete) return;
		await clientsApi.delete(clientToDelete.id, companyId);
		clients = clients.filter((c) => c.id !== clientToDelete!.id);
		clientToDelete = null;
	}

	const filteredClients = $derived(
		searchQuery
			? clients.filter(
					(c) =>
						c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
						c.email.toLowerCase().includes(searchQuery.toLowerCase())
				)
			: clients
	);
</script>

<div class="p-6">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
		<div>
			<h1 class="text-2xl font-semibold text-surface-900">Clients</h1>
			<p class="text-surface-500 mt-1">Manage your client contacts</p>
		</div>
		<button class="btn btn-primary" onclick={() => goto(`/companies/${companyId}/clients/new`)}>
			<span class="material-icons text-sm">person_add</span>
			Add Client
		</button>
	</div>

	<!-- Search -->
	<div class="mb-6">
		<div class="relative max-w-md">
			<span class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 material-icons text-lg">
				search
			</span>
			<input
				type="text"
				placeholder="Search clients..."
				class="input pl-10"
				bind:value={searchQuery}
			/>
		</div>
	</div>

	<!-- Loading State -->
	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="text-surface-500">Loading clients...</div>
		</div>
	{:else if error}
		<ErrorState
			title="Unable to Load Clients"
			message={error}
			onRetry={loadClients}
		/>
	{:else if filteredClients.length === 0}
		<!-- Empty State -->
		<div class="card p-8 text-center">
			<div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
				<span class="material-icons text-3xl text-surface-400">people</span>
			</div>
			<h3 class="text-lg font-medium text-surface-900 mb-2">
				{searchQuery ? 'No clients found' : 'No clients yet'}
			</h3>
			<p class="text-surface-500 mb-4">
				{searchQuery ? 'Try a different search term' : 'Add your first client to get started'}
			</p>
			{#if !searchQuery}
				<button class="btn btn-primary" onclick={() => goto(`/companies/${companyId}/clients/new`)}>
					<span class="material-icons text-sm">person_add</span>
					Add Client
				</button>
			{/if}
		</div>
	{:else}
		<!-- Clients Table -->
		<div class="card overflow-hidden">
			<table class="table">
				<thead>
					<tr>
						<th>Name</th>
						<th>Email</th>
						<th>Phone</th>
						<th>Status</th>
						<th class="w-24">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredClients as client}
						<tr
							class="cursor-pointer hover:bg-surface-50"
							onclick={() => goto(`/companies/${companyId}/clients/${client.id}`)}
						>
							<td>
								<div class="flex items-center gap-3">
									<div
										class="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-sm font-medium"
									>
										{client.name.charAt(0).toUpperCase()}
									</div>
									<span class="font-medium text-surface-900">{client.name}</span>
								</div>
							</td>
							<td class="text-surface-600">{client.email}</td>
							<td class="text-surface-600">{client.phone || '-'}</td>
							<td>
								<span class="badge {client.isActive ? 'badge-success' : 'badge-error'}">
									{client.isActive ? 'Active' : 'Inactive'}
								</span>
							</td>
							<td>
								<div class="flex items-center gap-1">
									<button
										class="p-1 hover:bg-surface-100 rounded"
										onclick={(e) => { e.stopPropagation(); goto(`/companies/${companyId}/clients/${client.id}`); }}
										title="Edit"
									>
										<span class="material-icons text-lg text-surface-500">edit</span>
									</button>
									<button
										class="p-1 hover:bg-surface-100 rounded"
										onclick={(e) => { e.stopPropagation(); openDeleteModal(client); }}
										title="Delete"
									>
										<span class="material-icons text-lg text-red-500">delete</span>
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

<ConfirmDeleteModal
	bind:open={showDeleteModal}
	title="Delete Client"
	message="Are you sure you want to delete"
	itemName={clientToDelete?.name || ''}
	onConfirm={deleteClient}
/>
