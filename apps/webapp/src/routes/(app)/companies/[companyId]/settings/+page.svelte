<script lang="ts">
	import { page } from '$app/stores';
	import { companiesApi, type Company } from '$lib/api/client';
	import { onMount } from 'svelte';

	let companyId = $derived($page.params.companyId);

	let company = $state<Company | null>(null);
	let loading = $state(true);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);

	let formData = $state({
		name: '',
		email: '',
		phone: '',
		address: {
			line1: '',
			line2: '',
			city: '',
			state: '',
			postalCode: '',
			country: 'South Africa'
		}
	});

	onMount(async () => {
		await loadCompany();
	});

	async function loadCompany() {
		loading = true;
		error = null;
		try {
			company = await companiesApi.get(companyId);
			formData = {
				name: company.name,
				email: company.email,
				phone: company.phone || '',
				address: {
					line1: company.address?.line1 || '',
					line2: company.address?.line2 || '',
					city: company.address?.city || '',
					state: company.address?.state || '',
					postalCode: company.address?.postalCode || '',
					country: company.address?.country || 'South Africa'
				}
			};
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load company';
			// Demo data
			company = {
				id: companyId,
				name: 'Demo Company',
				email: 'demo@company.com',
				isActive: true,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};
			formData = {
				name: company.name,
				email: company.email,
				phone: '',
				address: {
					line1: '',
					line2: '',
					city: '',
					state: '',
					postalCode: '',
					country: 'South Africa'
				}
			};
			error = null;
		} finally {
			loading = false;
		}
	}

	async function saveSettings() {
		saving = true;
		error = null;
		success = null;
		try {
			await companiesApi.update(companyId, formData);
			success = 'Settings saved successfully';
			setTimeout(() => (success = null), 3000);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save settings';
		} finally {
			saving = false;
		}
	}
</script>

<div class="p-6 max-w-2xl">
	<div class="mb-6">
		<h1 class="text-2xl font-semibold text-surface-900">Company Settings</h1>
		<p class="text-surface-500 mt-1">Manage your company information</p>
	</div>

	{#if error}
		<div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
	{/if}

	{#if success}
		<div class="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">{success}</div>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="text-surface-500">Loading settings...</div>
		</div>
	{:else}
		<form class="space-y-6" onsubmit={(e) => { e.preventDefault(); saveSettings(); }}>
			<!-- Basic Info -->
			<div class="card p-5">
				<h2 class="text-lg font-medium text-surface-900 mb-4">Basic Information</h2>
				<div class="space-y-4">
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
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
					</div>
				</div>
			</div>

			<!-- Address -->
			<div class="card p-5">
				<h2 class="text-lg font-medium text-surface-900 mb-4">Address</h2>
				<div class="space-y-4">
					<div>
						<label for="line1" class="block text-sm font-medium text-surface-700 mb-1">
							Street Address
						</label>
						<input
							id="line1"
							type="text"
							class="input"
							bind:value={formData.address.line1}
							placeholder="123 Main Street"
						/>
					</div>
					<div>
						<label for="line2" class="block text-sm font-medium text-surface-700 mb-1">
							Address Line 2
						</label>
						<input
							id="line2"
							type="text"
							class="input"
							bind:value={formData.address.line2}
							placeholder="Suite 100"
						/>
					</div>
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label for="city" class="block text-sm font-medium text-surface-700 mb-1">
								City
							</label>
							<input
								id="city"
								type="text"
								class="input"
								bind:value={formData.address.city}
							/>
						</div>
						<div>
							<label for="state" class="block text-sm font-medium text-surface-700 mb-1">
								State/Province
							</label>
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
							<label for="postalCode" class="block text-sm font-medium text-surface-700 mb-1">
								Postal Code
							</label>
							<input
								id="postalCode"
								type="text"
								class="input"
								bind:value={formData.address.postalCode}
							/>
						</div>
						<div>
							<label for="country" class="block text-sm font-medium text-surface-700 mb-1">
								Country
							</label>
							<input
								id="country"
								type="text"
								class="input"
								bind:value={formData.address.country}
							/>
						</div>
					</div>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex justify-end">
				<button type="submit" class="btn btn-primary" disabled={saving}>
					{#if saving}
						Saving...
					{:else}
						Save Settings
					{/if}
				</button>
			</div>
		</form>
	{/if}
</div>
