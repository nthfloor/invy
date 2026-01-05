<script lang="ts">
	import { page } from '$app/stores';

	let { children } = $props();

	const navItems = [
		{ href: '/portal/invoices', label: 'Invoices', icon: 'receipt' },
		{ href: '/portal/statements', label: 'Statements', icon: 'description' },
		{ href: '/portal/payments', label: 'Payments', icon: 'payments' }
	];

	function isActive(href: string): boolean {
		return $page.url.pathname.startsWith(href);
	}
</script>

<div class="min-h-screen bg-surface-100">
	<!-- Portal Header -->
	<header class="bg-surface-50 border-b border-surface-200">
		<div class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div
					class="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold"
				>
					I
				</div>
				<div>
					<span class="text-xl font-semibold text-surface-900">Invy</span>
					<span class="text-sm text-surface-500 ml-2">Client Portal</span>
				</div>
			</div>
			<div class="flex items-center gap-4">
				<span class="text-sm text-surface-500">Welcome, Client</span>
				<button class="btn btn-secondary text-sm">
					<span class="material-icons text-sm">logout</span>
					Sign Out
				</button>
			</div>
		</div>
	</header>

	<!-- Portal Navigation -->
	<nav class="bg-surface-50 border-b border-surface-200">
		<div class="max-w-6xl mx-auto px-4">
			<div class="flex gap-1">
				{#each navItems as item}
					<a
						href={item.href}
						class="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors {isActive(
							item.href
						)
							? 'border-primary-600 text-primary-700'
							: 'border-transparent text-surface-600 hover:text-surface-900 hover:border-surface-300'}"
					>
						<span class="material-icons text-lg">{item.icon}</span>
						{item.label}
					</a>
				{/each}
			</div>
		</div>
	</nav>

	<!-- Portal Content -->
	<main class="max-w-6xl mx-auto px-4 py-6">
		{@render children()}
	</main>

	<!-- Portal Footer -->
	<footer class="border-t border-surface-200 mt-8">
		<div class="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-surface-500">
			<p>Powered by Invy - Invoicing Made Simple</p>
		</div>
	</footer>
</div>

<svelte:head>
	<link
		href="https://fonts.googleapis.com/icon?family=Material+Icons"
		rel="stylesheet"
	/>
</svelte:head>
