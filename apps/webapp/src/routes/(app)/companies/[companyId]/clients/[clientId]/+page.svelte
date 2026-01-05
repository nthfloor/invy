<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { clientsApi, type Client } from '$lib/api/client';
	import ConfirmDeleteModal from '$lib/components/ConfirmDeleteModal.svelte';

	let companyId = $derived($page.params.companyId);
	let clientId = $derived($page.params.clientId);

	let client = $state<Client | null>(null);
	let loading = $state(true);
	let saving = $state(false);
	let error = $state<string | null>(null);

	let showDeleteModal = $state(false);

	let formData = $state({
		name: '',
		email: '',
		phone: '',
		vatNumber: '',
		taxNumber: '',
		registrationNumber: '',
		notes: '',
		isActive: true,
		address: {
			line1: '',
			line2: '',
			city: '',
			state: '',
			postalCode: '',
			country: ''
		}
	});

	onMount(async () => {
		await loadClient();
	});

	async function loadClient() {
		if (!companyId || !clientId) return;
		loading = true;
		error = null;
		try {
			client = await clientsApi.get(clientId, companyId);
			formData = {
				name: client.name,
				email: client.email,
				phone: client.phone || '',
				vatNumber: client.vatNumber || '',
				taxNumber: client.taxNumber || '',
				registrationNumber: client.registrationNumber || '',
				notes: client.notes || '',
				isActive: client.isActive,
				address: {
					line1: client.address?.line1 || '',
					line2: client.address?.line2 || '',
					city: client.address?.city || '',
					state: client.address?.state || '',
					postalCode: client.address?.postalCode || '',
					country: client.address?.country || ''
				}
			};
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load client';
		} finally {
			loading = false;
		}
	}

	async function saveClient() {
		if (!companyId || !clientId) return;
		saving = true;
		error = null;
		try {
			const hasAddress = Object.values(formData.address).some((v) => v);
			await clientsApi.update(clientId, companyId, {
				name: formData.name,
				email: formData.email,
				phone: formData.phone || undefined,
				vatNumber: formData.vatNumber || undefined,
				taxNumber: formData.taxNumber || undefined,
				registrationNumber: formData.registrationNumber || undefined,
				notes: formData.notes || undefined,
				isActive: formData.isActive,
				address: hasAddress ? formData.address : undefined
			});
			goto(`/companies/${companyId}/clients`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save client';
		} finally {
			saving = false;
		}
	}

	async function deleteClient() {
		if (!companyId || !clientId) return;
		await clientsApi.delete(clientId, companyId);
		goto(`/companies/${companyId}/clients`);
	}
</script>

<div class="p-6 max-w-2xl">
	<!-- Header -->
	<div class="flex items-center gap-4 mb-6">
		<button
			class="p-2 hover:bg-surface-100 rounded-lg transition-colors"
			onclick={() => goto(`/companies/${companyId}/clients`)}
		>
			<span class="material-icons text-surface-600">arrow_back</span>
		</button>
		<div class="flex-1">
			<h1 class="text-2xl font-semibold text-surface-900">
				{loading ? 'Loading...' : client?.name || 'Client'}
			</h1>
			<p class="text-surface-500 mt-1">Edit client details</p>
		</div>
		{#if client}
			<button
				class="btn bg-red-50 text-red-600 hover:bg-red-100"
				onclick={() => (showDeleteModal = true)}
			>
				<span class="material-icons text-sm">delete</span>
				Delete
			</button>
		{/if}
	</div>

	{#if error}
		<div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="text-surface-500">Loading client...</div>
		</div>
	{:else if client}
		<form class="card p-6 space-y-6" onsubmit={(e) => { e.preventDefault(); saveClient(); }}>
			<!-- Basic Info -->
			<div class="space-y-4">
				<h3 class="text-sm font-medium text-surface-900 uppercase tracking-wide">Contact Information</h3>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label for="name" class="block text-sm font-medium text-surface-700 mb-1">Name *</label>
						<input
							id="name"
							type="text"
							class="input"
							bind:value={formData.name}
							required
						/>
					</div>
					<div>
						<label for="email" class="block text-sm font-medium text-surface-700 mb-1">Email *</label>
						<input
							id="email"
							type="email"
							class="input"
							bind:value={formData.email}
							required
						/>
					</div>
				</div>
				<div>
					<label for="phone" class="block text-sm font-medium text-surface-700 mb-1">Phone</label>
					<input
						id="phone"
						type="tel"
						class="input"
						bind:value={formData.phone}
					/>
				</div>
			</div>

			<!-- Registration Details -->
			<div class="space-y-4">
				<h3 class="text-sm font-medium text-surface-900 uppercase tracking-wide">Registration Details</h3>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div>
						<label for="vatNumber" class="block text-sm font-medium text-surface-700 mb-1">VAT Number</label>
						<input
							id="vatNumber"
							type="text"
							class="input"
							placeholder="e.g. VAT123456789"
							bind:value={formData.vatNumber}
						/>
					</div>
					<div>
						<label for="taxNumber" class="block text-sm font-medium text-surface-700 mb-1">Tax Number</label>
						<input
							id="taxNumber"
							type="text"
							class="input"
							placeholder="e.g. 9876543210"
							bind:value={formData.taxNumber}
						/>
					</div>
					<div>
						<label for="registrationNumber" class="block text-sm font-medium text-surface-700 mb-1">Registration Number</label>
						<input
							id="registrationNumber"
							type="text"
							class="input"
							placeholder="e.g. 2024/123456/07"
							bind:value={formData.registrationNumber}
						/>
					</div>
				</div>
			</div>

			<!-- Address -->
			<div class="space-y-4">
				<h3 class="text-sm font-medium text-surface-900 uppercase tracking-wide">Address</h3>
				<div>
					<label for="line1" class="block text-sm font-medium text-surface-700 mb-1">Address Line 1</label>
					<input
						id="line1"
						type="text"
						class="input"
						placeholder="Street address"
						bind:value={formData.address.line1}
					/>
				</div>
				<div>
					<label for="line2" class="block text-sm font-medium text-surface-700 mb-1">Address Line 2</label>
					<input
						id="line2"
						type="text"
						class="input"
						placeholder="Apartment, suite, etc."
						bind:value={formData.address.line2}
					/>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="city" class="block text-sm font-medium text-surface-700 mb-1">City</label>
						<input
							id="city"
							type="text"
							class="input"
							bind:value={formData.address.city}
						/>
					</div>
					<div>
						<label for="state" class="block text-sm font-medium text-surface-700 mb-1">State/Province</label>
						<input
							id="state"
							type="text"
							class="input"
							bind:value={formData.address.state}
						/>
					</div>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="postalCode" class="block text-sm font-medium text-surface-700 mb-1">Postal Code</label>
						<input
							id="postalCode"
							type="text"
							class="input"
							bind:value={formData.address.postalCode}
						/>
					</div>
					<div>
						<label for="country" class="block text-sm font-medium text-surface-700 mb-1">Country</label>
						<input
							id="country"
							type="text"
							class="input"
							bind:value={formData.address.country}
						/>
					</div>
				</div>
			</div>

			<!-- Notes -->
			<div>
				<label for="notes" class="block text-sm font-medium text-surface-700 mb-1">Notes</label>
				<textarea
					id="notes"
					class="input"
					rows="3"
					placeholder="Internal notes about this client"
					bind:value={formData.notes}
				></textarea>
			</div>

			<!-- Status -->
			<div>
				<label class="flex items-center gap-3 cursor-pointer">
					<input
						type="checkbox"
						class="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
						bind:checked={formData.isActive}
					/>
					<span class="text-sm font-medium text-surface-700">Active</span>
				</label>
				<p class="text-xs text-surface-500 mt-1 ml-7">Inactive clients won't appear in invoice creation</p>
			</div>

			<div class="flex justify-end gap-3 pt-4 border-t border-surface-200">
				<button
					type="button"
					class="btn btn-secondary"
					onclick={() => goto(`/companies/${companyId}/clients`)}
				>
					Cancel
				</button>
				<button type="submit" class="btn btn-primary" disabled={saving}>
					{saving ? 'Saving...' : 'Save Changes'}
				</button>
			</div>
		</form>
	{/if}
</div>

<ConfirmDeleteModal
	bind:open={showDeleteModal}
	title="Delete Client"
	message="Are you sure you want to delete"
	itemName={client?.name || ''}
	onConfirm={deleteClient}
/>
