<script lang="ts">
	import { page } from '$app/stores';
	import { companiesApi, type Company } from '$lib/api/client';
	import { onMount } from 'svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import { CURRENCY_INFO, DEFAULT_CURRENCY, type Currency } from '$lib/constants/currencies';

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
		taxId: '',
		taxNumber: '',
		registrationNumber: '',
		currency: DEFAULT_CURRENCY,
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
		if (!companyId) return;
		loading = true;
		error = null;
		try {
			company = await companiesApi.get(companyId);
			if (company) {
				formData = {
					name: company.name,
					email: company.email,
					phone: company.phone || '',
					taxId: company.taxId || '',
					taxNumber: company.taxNumber || '',
					registrationNumber: company.registrationNumber || '',
					currency: (company.currency || DEFAULT_CURRENCY) as Currency,
					address: {
						line1: company.address?.line1 || '',
						line2: company.address?.line2 || '',
						city: company.address?.city || '',
						state: company.address?.state || '',
						postalCode: company.address?.postalCode || '',
						country: company.address?.country || 'South Africa'
					}
				};
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load company';
		} finally {
			loading = false;
		}
	}

	async function saveSettings() {
		if (!companyId) return;
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

	{#if success}
		<div class="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">{success}</div>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="text-surface-500">Loading settings...</div>
		</div>
	{:else if error && !company}
		<ErrorState
			title="Unable to Load Settings"
			message={error}
			onRetry={loadCompany}
		/>
	{:else if company}
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
					<div>
						<label for="currency" class="block text-sm font-medium text-surface-700 mb-1">
							Currency *
						</label>
						<select id="currency" class="input" bind:value={formData.currency} required>
							{#each Object.values(CURRENCY_INFO) as currency}
								<option value={currency.code}>{currency.code} - {currency.name}</option>
							{/each}
						</select>
					</div>
				</div>
			</div>

			<!-- Registration Details -->
			<div class="card p-5">
				<h2 class="text-lg font-medium text-surface-900 mb-4">Registration Details</h2>
				<div class="space-y-4">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label for="taxId" class="block text-sm font-medium text-surface-700 mb-1">
								VAT Number
							</label>
							<input
								id="taxId"
								type="text"
								class="input"
								bind:value={formData.taxId}
								placeholder="e.g. VAT123456789"
							/>
						</div>
						<div>
							<label for="taxNumber" class="block text-sm font-medium text-surface-700 mb-1">
								Tax Number
							</label>
							<input
								id="taxNumber"
								type="text"
								class="input"
								bind:value={formData.taxNumber}
								placeholder="e.g. 9876543210"
							/>
						</div>
					</div>
					<div>
						<label for="registrationNumber" class="block text-sm font-medium text-surface-700 mb-1">
							Registration Number
						</label>
						<input
							id="registrationNumber"
							type="text"
							class="input"
							bind:value={formData.registrationNumber}
							placeholder="e.g. 2024/123456/07"
						/>
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
