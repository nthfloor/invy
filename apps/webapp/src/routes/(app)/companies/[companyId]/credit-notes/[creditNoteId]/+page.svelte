<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { creditNotesApi, invoicesApi, type CreditNote, type Invoice } from '$lib/api/client';

	let companyId = $derived($page.params.companyId);
	let creditNoteId = $derived($page.params.creditNoteId);

	let creditNote = $state<CreditNote | null>(null);
	let invoices = $state<Invoice[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let showApplyModal = $state(false);
	let applying = $state(false);
	let issuing = $state(false);

	let applyForm = $state({
		invoiceId: '',
		amount: 0
	});

	onMount(async () => {
		await Promise.all([loadCreditNote(), loadInvoices()]);
	});

	async function loadCreditNote() {
		if (!companyId || !creditNoteId) return;
		loading = true;
		error = null;
		try {
			creditNote = await creditNotesApi.get(creditNoteId, companyId);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load credit note';
		} finally {
			loading = false;
		}
	}

	async function loadInvoices() {
		if (!companyId) return;
		try {
			const result = await invoicesApi.list(companyId, { perPage: 100 });
			invoices = result.data.filter(inv => inv.balance > 0 && inv.status !== 'draft' && inv.status !== 'cancelled');
		} catch (e) {
			// Silently fail
		}
	}

	async function issueCreditNote() {
		if (!creditNote || !companyId) return;
		if (!confirm('Issue this credit note? This action cannot be undone.')) return;
		issuing = true;
		error = null;
		try {
			await creditNotesApi.issue(creditNote.id, companyId);
			await loadCreditNote();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to issue credit note';
		} finally {
			issuing = false;
		}
	}

	function openApplyModal() {
		if (!creditNote) return;
		applyForm = {
			invoiceId: creditNote.invoiceId,
			amount: creditNote.balance
		};
		showApplyModal = true;
	}

	async function applyCreditNote() {
		if (!creditNote || !companyId) return;
		if (!applyForm.invoiceId) {
			error = 'Please select an invoice';
			return;
		}
		applying = true;
		error = null;
		try {
			await creditNotesApi.apply(creditNote.id, companyId, applyForm.invoiceId, applyForm.amount);
			await loadCreditNote();
			showApplyModal = false;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to apply credit note';
		} finally {
			applying = false;
		}
	}

	async function voidCreditNote() {
		if (!creditNote || !companyId) return;
		const reason = prompt('Enter reason for voiding this credit note:');
		if (!reason) return;
		try {
			await creditNotesApi.void(creditNote.id, companyId, reason);
			await loadCreditNote();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to void credit note';
		}
	}

	function downloadPdf() {
		if (!companyId || !creditNoteId) return;
		const url = creditNotesApi.getPdfUrl(creditNoteId, companyId, true);
		window.open(url, '_blank');
	}

	function viewPdf() {
		if (!companyId || !creditNoteId) return;
		const url = creditNotesApi.getPdfUrl(creditNoteId, companyId, false);
		window.open(url, '_blank');
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
			case 'issued':
				return 'bg-blue-100 text-blue-700';
			case 'applied':
				return 'badge-success';
			case 'draft':
				return 'bg-surface-200 text-surface-600';
			case 'voided':
				return 'bg-surface-200 text-surface-500';
			default:
				return 'bg-surface-200 text-surface-600';
		}
	}

	const applicableInvoices = $derived(
		creditNote?.clientId
			? invoices.filter(inv => inv.clientId === creditNote.clientId)
			: invoices
	);
</script>

<div class="p-6">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
		<div class="flex items-center gap-4">
			<button class="p-2 hover:bg-surface-100 rounded-lg" onclick={() => goto(`/companies/${companyId}/credit-notes`)}>
				<span class="material-icons text-surface-500">arrow_back</span>
			</button>
			<div>
				<div class="flex items-center gap-3">
					<h1 class="text-2xl font-semibold text-surface-900">
						{creditNote?.creditNoteNumber || 'Loading...'}
					</h1>
					{#if creditNote}
						<span class="badge {getStatusClass(creditNote.status)} capitalize">
							{creditNote.status}
						</span>
					{/if}
				</div>
				{#if creditNote}
					<p class="text-surface-500 mt-1">{creditNote.reason}</p>
				{/if}
			</div>
		</div>
		{#if creditNote}
			<div class="flex items-center gap-2">
				{#if creditNote.status === 'draft'}
					<button class="btn btn-primary" onclick={issueCreditNote} disabled={issuing}>
						{issuing ? 'Issuing...' : 'Issue Credit Note'}
					</button>
				{/if}
				{#if creditNote.status === 'issued' && creditNote.balance > 0}
					<button class="btn btn-secondary" onclick={openApplyModal}>
						<span class="material-icons text-sm">payments</span>
						Apply to Invoice
					</button>
				{/if}
				{#if creditNote.status !== 'voided' && creditNote.status !== 'applied'}
					<button class="btn bg-red-50 text-red-600 hover:bg-red-100" onclick={voidCreditNote}>
						<span class="material-icons text-sm">block</span>
						Void
					</button>
				{/if}
				<button class="btn btn-secondary" onclick={viewPdf}>
					<span class="material-icons text-sm">visibility</span>
					View PDF
				</button>
				<button class="btn btn-secondary" onclick={downloadPdf}>
					<span class="material-icons text-sm">download</span>
					Download
				</button>
			</div>
		{/if}
	</div>

	{#if error}
		<div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="text-surface-500">Loading credit note...</div>
		</div>
	{:else if creditNote}
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- Main Content -->
			<div class="lg:col-span-2 space-y-6">
				<!-- Credit Note Details -->
				<div class="card p-6">
					<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
						<div>
							<p class="text-sm text-surface-500">Issue Date</p>
							<p class="font-medium text-surface-900">{formatDate(creditNote.issueDate)}</p>
						</div>
						<div>
							<p class="text-sm text-surface-500">Related Invoice</p>
							<button
								class="font-medium text-primary-600 hover:text-primary-700"
								onclick={() => goto(`/companies/${companyId}/invoices/${creditNote?.invoiceId}`)}
							>
								View Invoice
							</button>
						</div>
						<div>
							<p class="text-sm text-surface-500">Credit Total</p>
							<p class="font-medium text-surface-900">{formatCurrency(creditNote.total)}</p>
						</div>
						<div>
							<p class="text-sm text-surface-500">Balance</p>
							<p class="font-medium {creditNote.balance > 0 ? 'text-blue-600' : 'text-green-600'}">
								{formatCurrency(creditNote.balance)}
							</p>
						</div>
					</div>

					<!-- Totals -->
					<div class="flex justify-end">
						<div class="w-72 space-y-2">
							<div class="flex justify-between text-sm">
								<span class="text-surface-500">Subtotal</span>
								<span class="text-surface-900">{formatCurrency(creditNote.subtotal)}</span>
							</div>
							<div class="flex justify-between text-sm">
								<span class="text-surface-500">Tax</span>
								<span class="text-surface-900">{formatCurrency(creditNote.taxTotal)}</span>
							</div>
							<div class="flex justify-between text-base font-semibold border-t border-surface-200 pt-2">
								<span class="text-surface-900">Credit Total</span>
								<span class="text-surface-900">{formatCurrency(creditNote.total)}</span>
							</div>
							{#if creditNote.amountApplied > 0}
								<div class="flex justify-between text-sm text-green-600">
									<span>Amount Applied</span>
									<span>-{formatCurrency(creditNote.amountApplied)}</span>
								</div>
							{/if}
							<div class="flex justify-between text-base font-semibold border-t border-surface-200 pt-2">
								<span class="text-surface-900">Remaining Balance</span>
								<span class="text-surface-900 {creditNote.balance > 0 ? '' : 'text-green-600'}">
									{formatCurrency(creditNote.balance)}
								</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Notes -->
				{#if creditNote.notes}
					<div class="card p-6">
						<h3 class="text-sm font-medium text-surface-700 mb-2">Notes</h3>
						<p class="text-surface-600 text-sm whitespace-pre-wrap">{creditNote.notes}</p>
					</div>
				{/if}

				<!-- Void Reason -->
				{#if creditNote.status === 'voided' && creditNote.voidReason}
					<div class="card p-6 border-red-200 bg-red-50">
						<h3 class="text-sm font-medium text-red-700 mb-2">Void Reason</h3>
						<p class="text-red-600 text-sm whitespace-pre-wrap">{creditNote.voidReason}</p>
					</div>
				{/if}
			</div>

			<!-- Sidebar -->
			<div class="space-y-6">
				<!-- Credit Summary -->
				<div class="card p-5">
					<h3 class="text-sm font-medium text-surface-700 mb-4">Credit Summary</h3>
					<div class="space-y-3">
						<div class="flex justify-between">
							<span class="text-surface-500">Total Credit</span>
							<span class="font-medium text-surface-900">{formatCurrency(creditNote.total)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-surface-500">Applied</span>
							<span class="font-medium text-green-600">{formatCurrency(creditNote.amountApplied)}</span>
						</div>
						<div class="flex justify-between border-t border-surface-200 pt-3">
							<span class="font-medium text-surface-900">Available</span>
							<span class="font-semibold {creditNote.balance > 0 ? 'text-blue-600' : 'text-surface-500'}">
								{formatCurrency(creditNote.balance)}
							</span>
						</div>
					</div>
				</div>

				<!-- Timeline -->
				<div class="card p-5">
					<h3 class="text-sm font-medium text-surface-700 mb-4">Timeline</h3>
					<div class="space-y-4">
						<div class="flex gap-3">
							<div class="w-2 h-2 bg-surface-400 rounded-full mt-2"></div>
							<div>
								<p class="text-sm font-medium text-surface-900">Created</p>
								<p class="text-xs text-surface-500">{formatDate(creditNote.createdOn)}</p>
							</div>
						</div>
						{#if creditNote.status !== 'draft'}
							<div class="flex gap-3">
								<div class="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
								<div>
									<p class="text-sm font-medium text-surface-900">Issued</p>
									<p class="text-xs text-surface-500">{formatDate(creditNote.issueDate)}</p>
								</div>
							</div>
						{/if}
						{#if creditNote.status === 'applied'}
							<div class="flex gap-3">
								<div class="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
								<div>
									<p class="text-sm font-medium text-surface-900">Fully Applied</p>
									<p class="text-xs text-surface-500">{formatDate(creditNote.updatedOn)}</p>
								</div>
							</div>
						{/if}
						{#if creditNote.status === 'voided'}
							<div class="flex gap-3">
								<div class="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
								<div>
									<p class="text-sm font-medium text-surface-900">Voided</p>
									<p class="text-xs text-surface-500">{formatDate(creditNote.updatedOn)}</p>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Apply Credit Note Modal -->
{#if showApplyModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
		<div class="card w-full max-w-md mx-4">
			<div class="p-4 border-b border-surface-200 flex justify-between items-center">
				<h2 class="text-lg font-medium text-surface-900">Apply Credit Note</h2>
				<button class="text-surface-400 hover:text-surface-600" onclick={() => (showApplyModal = false)}>
					<span class="material-icons">close</span>
				</button>
			</div>
			<form class="p-4 space-y-4" onsubmit={(e) => { e.preventDefault(); applyCreditNote(); }}>
				<div>
					<label for="applyInvoiceId" class="block text-sm font-medium text-surface-700 mb-1">Apply to Invoice *</label>
					<select id="applyInvoiceId" class="input" bind:value={applyForm.invoiceId} required>
						<option value="">Select an invoice</option>
						{#each applicableInvoices as invoice}
							<option value={invoice.id}>{invoice.invoiceNumber} - Balance: {formatCurrency(invoice.balance)}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="applyAmount" class="block text-sm font-medium text-surface-700 mb-1">Amount *</label>
					<input
						id="applyAmount"
						type="number"
						step="0.01"
						min="0.01"
						max={creditNote?.balance || 0}
						class="input"
						bind:value={applyForm.amount}
						required
					/>
					{#if creditNote}
						<p class="text-xs text-surface-500 mt-1">Available: {formatCurrency(creditNote.balance)}</p>
					{/if}
				</div>
				<div class="flex justify-end gap-3 pt-4">
					<button type="button" class="btn btn-secondary" onclick={() => (showApplyModal = false)}>
						Cancel
					</button>
					<button type="submit" class="btn btn-primary" disabled={applying}>
						{applying ? 'Applying...' : 'Apply Credit'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
