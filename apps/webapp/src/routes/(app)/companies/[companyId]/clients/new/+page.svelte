<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { clientsApi } from '$lib/api/client';

	let companyId = $derived($page.params.companyId);

	let saving = $state(false);
	let error = $state<string | null>(null);

	let formData = $state({
		name: '',
		email: '',
		phone: '',
		vatNumber: '',
		taxNumber: '',
		registrationNumber: '',
		notes: '',
		address: {
			line1: '',
			line2: '',
			city: '',
			state: '',
			postalCode: '',
			country: ''
		}
	});

	async function createClient() {
		if (!companyId) return;
		saving = true;
		error = null;
		try {
			const hasAddress = Object.values(formData.address).some((v) => v);
			await clientsApi.create(companyId, {
				name: formData.name,
				email: formData.email,
				phone: formData.phone || undefined,
				vatNumber: formData.vatNumber || undefined,
				taxNumber: formData.taxNumber || undefined,
				registrationNumber: formData.registrationNumber || undefined,
				notes: formData.notes || undefined,
				address: hasAddress ? formData.address : undefined
			});
			goto(`/companies/${companyId}/clients`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create client';
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
			onclick={() => goto(`/companies/${companyId}/clients`)}
		>
			<span class="material-icons text-surface-600">arrow_back</span>
		</button>
		<div>
			<h1 class="text-2xl font-semibold text-surface-900">New Client</h1>
			<p class="text-surface-500 mt-1">Add a new client to your contacts</p>
		</div>
	</div>

	{#if error}
		<div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
	{/if}

	<form class="card p-6 space-y-6" onsubmit={(e) => { e.preventDefault(); createClient(); }}>
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
						placeholder="e.g. John Smith"
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
						placeholder="e.g. john@example.com"
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
					placeholder="e.g. +27 82 123 4567"
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
						placeholder="e.g. South Africa"
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

		<div class="flex justify-end gap-3 pt-4 border-t border-surface-200">
			<button
				type="button"
				class="btn btn-secondary"
				onclick={() => goto(`/companies/${companyId}/clients`)}
			>
				Cancel
			</button>
			<button type="submit" class="btn btn-primary" disabled={saving}>
				{saving ? 'Creating...' : 'Create Client'}
			</button>
		</div>
	</form>
</div>
