<script lang="ts">
	import { goto } from '$app/navigation';
	import { companiesApi } from '$lib/api/client';

	let saving = $state(false);
	let error = $state<string | null>(null);

	let formData = $state({
		name: '',
		email: '',
		phone: '',
		taxId: '',
		taxNumber: '',
		registrationNumber: '',
		currency: 'ZAR',
		address: {
			line1: '',
			line2: '',
			city: '',
			state: '',
			postalCode: '',
			country: ''
		}
	});

	async function createCompany() {
		saving = true;
		error = null;
		try {
			const hasAddress = Object.values(formData.address).some((v) => v);
			await companiesApi.create({
				name: formData.name,
				email: formData.email,
				phone: formData.phone || undefined,
				taxId: formData.taxId || undefined,
				taxNumber: formData.taxNumber || undefined,
				registrationNumber: formData.registrationNumber || undefined,
				currency: formData.currency,
				address: hasAddress ? formData.address : undefined
			});
			goto('/companies');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create company';
		} finally {
			saving = false;
		}
	}
</script>

<div class="p-6 max-w-2xl">
	<!-- Header -->
	<div class="flex items-center gap-4 mb-6">
		<button
			class="p-2 hover:bg-surface-100 rounded-lg transition-colors"
			onclick={() => goto('/companies')}
		>
			<span class="material-icons text-surface-600">arrow_back</span>
		</button>
		<div>
			<h1 class="text-2xl font-semibold text-surface-900">New Company</h1>
			<p class="text-surface-500 mt-1">Create a new company to start invoicing</p>
		</div>
	</div>

	{#if error}
		<div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
	{/if}

	<form class="card p-6 space-y-6" onsubmit={(e) => { e.preventDefault(); createCompany(); }}>
		<!-- Basic Info -->
		<div class="space-y-4">
			<h3 class="text-sm font-medium text-surface-900 uppercase tracking-wide">Company Information</h3>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label for="name" class="block text-sm font-medium text-surface-700 mb-1">Company Name *</label>
					<input
						id="name"
						type="text"
						class="input"
						placeholder="e.g. Acme Corporation"
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
						placeholder="e.g. contact@acme.com"
						bind:value={formData.email}
						required
					/>
				</div>
			</div>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label for="phone" class="block text-sm font-medium text-surface-700 mb-1">Phone</label>
					<input
						id="phone"
						type="tel"
						class="input"
						placeholder="e.g. +27 11 123 4567"
						bind:value={formData.phone}
					/>
				</div>
				<div>
					<label for="currency" class="block text-sm font-medium text-surface-700 mb-1">Currency *</label>
					<select id="currency" class="input" bind:value={formData.currency} required>
						<option value="ZAR">ZAR - South African Rand</option>
						<option value="USD">USD - US Dollar</option>
						<option value="EUR">EUR - Euro</option>
						<option value="GBP">GBP - British Pound</option>
					</select>
				</div>
			</div>
		</div>

		<!-- Registration Details -->
		<div class="space-y-4">
			<h3 class="text-sm font-medium text-surface-900 uppercase tracking-wide">Registration Details</h3>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label for="taxId" class="block text-sm font-medium text-surface-700 mb-1">VAT Number</label>
					<input
						id="taxId"
						type="text"
						class="input"
						placeholder="e.g. VAT123456789"
						bind:value={formData.taxId}
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
						placeholder="e.g. South Africa"
						bind:value={formData.address.country}
					/>
				</div>
			</div>
		</div>

		<div class="flex justify-end gap-3 pt-4 border-t border-surface-200">
			<button
				type="button"
				class="btn btn-secondary"
				onclick={() => goto('/companies')}
			>
				Cancel
			</button>
			<button type="submit" class="btn btn-primary" disabled={saving}>
				{saving ? 'Creating...' : 'Create Company'}
			</button>
		</div>
	</form>
</div>
