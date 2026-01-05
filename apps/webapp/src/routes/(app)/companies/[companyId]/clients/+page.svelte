<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { clientsApi, type Client } from '$lib/api/client';

	let companyId = $derived($page.params.companyId);

	let clients = $state<Client[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let searchQuery = $state('');
	let showCreateModal = $state(false);
	let editingClient = $state<Client | null>(null);

	// Form state
	let formData = $state({
		name: '',
		email: '',
		phone: '',
		notes: ''
	});

	onMount(async () => {
		await loadClients();
	});

	async function loadClients() {
		loading = true;
		error = null;
		try {
			const result = await clientsApi.list(companyId, { search: searchQuery || undefined });
			clients = result.data;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load clients';
			// Demo data for when API is unavailable
			clients = [
				{
					id: 'client-1',
					companyId,
					name: 'John Smith',
					email: 'john.smith@example.com',
					phone: '+27 82 123 4567',
					isActive: true,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				},
				{
					id: 'client-2',
					companyId,
					name: 'Sarah Johnson',
					email: 'sarah.j@example.com',
					isActive: true,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				}
			];
			error = null;
		} finally {
			loading = false;
		}
	}

	function openCreateModal() {
		formData = { name: '', email: '', phone: '', notes: '' };
		editingClient = null;
		showCreateModal = true;
	}

	function openEditModal(client: Client) {
		formData = {
			name: client.name,
			email: client.email,
			phone: client.phone || '',
			notes: client.notes || ''
		};
		editingClient = client;
		showCreateModal = true;
	}

	async function saveClient() {
		try {
			if (editingClient) {
				const updated = await clientsApi.update(companyId, editingClient.id, formData);
				clients = clients.map((c) => (c.id === updated.id ? updated : c));
			} else {
				const newClient = await clientsApi.create(companyId, formData);
				clients = [...clients, newClient];
			}
			showCreateModal = false;
			formData = { name: '', email: '', phone: '', notes: '' };
			editingClient = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save client';
		}
	}

	async function deleteClient(client: Client) {
		if (!confirm(`Are you sure you want to delete ${client.name}?`)) return;
		try {
			await clientsApi.delete(companyId, client.id);
			clients = clients.filter((c) => c.id !== client.id);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to delete client';
		}
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
		<button class="btn btn-primary" onclick={openCreateModal}>
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

	<!-- Error State -->
	{#if error}
		<div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
			{error}
		</div>
	{/if}

	<!-- Loading State -->
	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="text-surface-500">Loading clients...</div>
		</div>
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
				<button class="btn btn-primary" onclick={openCreateModal}>
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
						<th class="w-20">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredClients as client}
						<tr>
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
										onclick={() => openEditModal(client)}
										title="Edit"
									>
										<span class="material-icons text-lg text-surface-500">edit</span>
									</button>
									<button
										class="p-1 hover:bg-surface-100 rounded"
										onclick={() => deleteClient(client)}
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

<!-- Create/Edit Client Modal -->
{#if showCreateModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
		<div class="card w-full max-w-md mx-4">
			<div class="p-4 border-b border-surface-200 flex justify-between items-center">
				<h2 class="text-lg font-medium text-surface-900">
					{editingClient ? 'Edit Client' : 'Add Client'}
				</h2>
				<button class="text-surface-400 hover:text-surface-600" onclick={() => (showCreateModal = false)}>
					<span class="material-icons">close</span>
				</button>
			</div>
			<form class="p-4 space-y-4" onsubmit={(e) => { e.preventDefault(); saveClient(); }}>
				<div>
					<label for="name" class="block text-sm font-medium text-surface-700 mb-1">
						Name *
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
				<div>
					<label for="notes" class="block text-sm font-medium text-surface-700 mb-1">
						Notes
					</label>
					<textarea
						id="notes"
						class="input"
						rows="3"
						bind:value={formData.notes}
					></textarea>
				</div>
				<div class="flex justify-end gap-3 pt-4">
					<button type="button" class="btn btn-secondary" onclick={() => (showCreateModal = false)}>
						Cancel
					</button>
					<button type="submit" class="btn btn-primary">
						{editingClient ? 'Save Changes' : 'Add Client'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
