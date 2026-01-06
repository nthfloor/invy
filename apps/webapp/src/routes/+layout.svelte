<script lang="ts">
	import '../app.css';
	import { auth } from '$lib/stores/auth';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		auth.init();
	});
</script>

<svelte:head>
	<title>Invy - Invoicing Made Simple</title>
</svelte:head>

{@render children()}
