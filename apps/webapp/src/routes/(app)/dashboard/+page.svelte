<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		goto('/companies', { replaceState: true });
	});
</script>

<div class="flex items-center justify-center min-h-[50vh]">
	<div class="text-surface-500">Redirecting to companies...</div>
</div>
