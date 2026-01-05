<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { auth } from '$lib/stores/auth';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		auth.init();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Invy - Invoicing Made Simple</title>
</svelte:head>

{@render children()}
