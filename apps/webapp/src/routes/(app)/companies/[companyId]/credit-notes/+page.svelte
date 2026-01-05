<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { creditNotesApi, type CreditNote } from '$lib/api/client';
	import ErrorState from '$lib/components/ErrorState.svelte';

	let companyId = $derived($page.params.companyId);

	let creditNotes = $state<CreditNote[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let statusFilter = $state('');

	onMount(async () => {
		await loadCreditNotes();
	});

	async function loadCreditNotes() {
		if (!companyId) return;
		loading = true;
		error = null;
		try {
			const result = await creditNotesApi.list(companyId, { status: statusFilter || undefined });
			creditNotes = result.data;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load credit notes';
		} finally {
			loading = false;
		}
	}

	function viewCreditNote(creditNote: CreditNote) {
		goto(`/companies/${companyId}/credit-notes/${creditNote.id}`);
	}

	function downloadCreditNote(creditNote: CreditNote) {
		if (!companyId) return;
		const url = creditNotesApi.getPdfUrl(creditNote.id, companyId, true);
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

	const filteredCreditNotes = $derived(
		statusFilter ? creditNotes.filter((cn) => cn.status === statusFilter) : creditNotes
	);

	const stats = $derived({
		total: creditNotes.reduce((sum, cn) => sum + cn.total, 0),
		issued: creditNotes.filter((cn) => cn.status === 'issued').reduce((sum, cn) => sum + cn.total, 0),
		applied: creditNotes.filter((cn) => cn.status === 'applied').reduce((sum, cn) => sum + cn.total, 0),
		draft: creditNotes.filter((cn) => cn.status === 'draft').reduce((sum, cn) => sum + cn.total, 0)
	});
</script>

<div class="p-6">
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
		<div>
			<h1 class="text-2xl font-semibold text-surface-900">Credit Notes</h1>
			<p class="text-surface-500 mt-1">Issue and manage credit notes</p>
		</div>
		<button class="btn btn-primary" onclick={() => goto(`/companies/${companyId}/credit-notes/new`)}>
			<span class="material-icons text-sm">add</span>
			New Credit Note
		</button>
	</div>

	<!-- Stats -->
	<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
		<div class="card p-4">
			<p class="text-sm text-surface-500">Total</p>
			<p class="text-xl font-semibold text-surface-900">{formatCurrency(stats.total)}</p>
		</div>
		<div class="card p-4">
			<p class="text-sm text-surface-500">Draft</p>
			<p class="text-xl font-semibold text-surface-600">{formatCurrency(stats.draft)}</p>
		</div>
		<div class="card p-4">
			<p class="text-sm text-surface-500">Issued</p>
			<p class="text-xl font-semibold text-blue-600">{formatCurrency(stats.issued)}</p>
		</div>
		<div class="card p-4">
			<p class="text-sm text-surface-500">Applied</p>
			<p class="text-xl font-semibold text-green-600">{formatCurrency(stats.applied)}</p>
		</div>
	</div>

	<!-- Filters -->
	<div class="mb-6 flex gap-2">
		<button
			class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors {!statusFilter
				? 'bg-primary-600 text-white'
				: 'bg-surface-200 text-surface-600 hover:bg-surface-300'}"
			onclick={() => (statusFilter = '')}
		>
			All
		</button>
		{#each ['draft', 'issued', 'applied', 'voided'] as status}
			<button
				class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize {statusFilter ===
				status
					? 'bg-primary-600 text-white'
					: 'bg-surface-200 text-surface-600 hover:bg-surface-300'}"
				onclick={() => (statusFilter = status)}
			>
				{status}
			</button>
		{/each}
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="text-surface-500">Loading credit notes...</div>
		</div>
	{:else if error && creditNotes.length === 0}
		<ErrorState
			title="Unable to Load Credit Notes"
			message={error}
			onRetry={loadCreditNotes}
		/>
	{:else if filteredCreditNotes.length === 0}
		<div class="card p-8 text-center">
			<div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
				<span class="material-icons text-3xl text-surface-400">note_alt</span>
			</div>
			<h3 class="text-lg font-medium text-surface-900 mb-2">No credit notes</h3>
			<p class="text-surface-500 mb-4">Create a credit note to refund or adjust an invoice</p>
			<button class="btn btn-primary" onclick={() => goto(`/companies/${companyId}/credit-notes/new`)}>
				<span class="material-icons text-sm">add</span>
				New Credit Note
			</button>
		</div>
	{:else}
		<div class="card overflow-hidden">
			<table class="table">
				<thead>
					<tr>
						<th>Credit Note #</th>
						<th>Issue Date</th>
						<th>Reason</th>
						<th>Amount</th>
						<th>Balance</th>
						<th>Status</th>
						<th class="w-20">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredCreditNotes as creditNote}
						<tr class="cursor-pointer hover:bg-surface-50" onclick={() => viewCreditNote(creditNote)}>
							<td class="font-medium text-surface-900">{creditNote.creditNoteNumber}</td>
							<td class="text-surface-600">{formatDate(creditNote.issueDate)}</td>
							<td class="text-surface-600 max-w-xs truncate">{creditNote.reason}</td>
							<td class="font-medium text-surface-900">{formatCurrency(creditNote.total)}</td>
							<td class="font-medium {creditNote.balance > 0 ? 'text-blue-600' : 'text-surface-500'}">
								{formatCurrency(creditNote.balance)}
							</td>
							<td>
								<span class="badge {getStatusClass(creditNote.status)} capitalize">
									{creditNote.status}
								</span>
							</td>
							<td>
								<div class="flex items-center gap-1">
									<button
										class="p-1 hover:bg-surface-100 rounded"
										title="View"
										onclick={(e) => { e.stopPropagation(); viewCreditNote(creditNote); }}
									>
										<span class="material-icons text-lg text-surface-500">visibility</span>
									</button>
									<button
										class="p-1 hover:bg-surface-100 rounded"
										title="Download"
										onclick={(e) => { e.stopPropagation(); downloadCreditNote(creditNote); }}
									>
										<span class="material-icons text-lg text-surface-500">download</span>
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
