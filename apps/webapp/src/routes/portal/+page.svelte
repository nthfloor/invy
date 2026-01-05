<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		goto('/portal/invoices');
	});
</script>

<div class="flex items-center justify-center py-12">
	<p class="text-surface-500">Redirecting to invoices...</p>
</div>
