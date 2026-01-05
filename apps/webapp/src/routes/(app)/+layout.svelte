<script lang="ts">
	import { page } from '$app/stores';
	import { auth, user, currentCompanyId } from '$lib/stores/auth';

	let { children } = $props();

	const navItems = $derived([
		{ href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
		{ href: '/companies', label: 'Companies', icon: 'business' }
	]);

	const companyNavItems = $derived(
		$currentCompanyId
			? [
					{
						href: `/companies/${$currentCompanyId}/clients`,
						label: 'Clients',
						icon: 'people'
					},
					{
						href: `/companies/${$currentCompanyId}/products`,
						label: 'Products',
						icon: 'inventory'
					},
					{
						href: `/companies/${$currentCompanyId}/invoices`,
						label: 'Invoices',
						icon: 'receipt'
					},
					{
						href: `/companies/${$currentCompanyId}/payments`,
						label: 'Payments',
						icon: 'payments'
					},
					{
						href: `/companies/${$currentCompanyId}/settings`,
						label: 'Settings',
						icon: 'settings'
					}
				]
			: []
	);

	function isActive(href: string): boolean {
		return $page.url.pathname.startsWith(href);
	}
</script>

<div class="flex min-h-screen bg-surface-100">
	<!-- Sidebar -->
	<aside class="w-64 bg-surface-50 border-r border-surface-200 flex flex-col">
		<!-- Logo -->
		<div class="p-4 border-b border-surface-200">
			<a href="/dashboard" class="flex items-center gap-2">
				<div
					class="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold"
				>
					I
				</div>
				<span class="text-xl font-semibold text-surface-900">Invy</span>
			</a>
		</div>

		<!-- Navigation -->
		<nav class="flex-1 p-4 space-y-1">
			{#each navItems as item}
				<a
					href={item.href}
					class="flex items-center gap-3 px-3 py-2 rounded-md transition-colors {isActive(item.href)
						? 'bg-primary-50 text-primary-700'
						: 'text-surface-600 hover:bg-surface-100'}"
				>
					<span class="material-icons text-lg">{item.icon}</span>
					<span>{item.label}</span>
				</a>
			{/each}

			{#if $currentCompanyId}
				<div class="pt-4 mt-4 border-t border-surface-200">
					<p class="px-3 pb-2 text-xs font-medium text-surface-400 uppercase">Company</p>
					{#each companyNavItems as item}
						<a
							href={item.href}
							class="flex items-center gap-3 px-3 py-2 rounded-md transition-colors {isActive(
								item.href
							)
								? 'bg-primary-50 text-primary-700'
								: 'text-surface-600 hover:bg-surface-100'}"
						>
							<span class="material-icons text-lg">{item.icon}</span>
							<span>{item.label}</span>
						</a>
					{/each}
				</div>
			{/if}
		</nav>

		<!-- User section -->
		<div class="p-4 border-t border-surface-200">
			{#if $user}
				<div class="flex items-center gap-3">
					<div
						class="w-8 h-8 bg-surface-300 rounded-full flex items-center justify-center text-surface-600"
					>
						{$user.name.charAt(0).toUpperCase()}
					</div>
					<div class="flex-1 min-w-0">
						<p class="text-sm font-medium text-surface-900 truncate">{$user.name}</p>
						<p class="text-xs text-surface-500 truncate">{$user.email}</p>
					</div>
				</div>
			{/if}
		</div>
	</aside>

	<!-- Main content -->
	<main class="flex-1 overflow-auto">
		{@render children()}
	</main>
</div>

<svelte:head>
	<link
		href="https://fonts.googleapis.com/icon?family=Material+Icons"
		rel="stylesheet"
	/>
</svelte:head>
