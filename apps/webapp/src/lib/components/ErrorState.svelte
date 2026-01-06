<script lang="ts">
	let {
		title = 'Something went wrong',
		message = 'An error occurred. Please try again.',
		icon = 'cloud_off',
		onRetry
	}: {
		title?: string;
		message?: string;
		icon?: string;
		onRetry?: () => void;
	} = $props();

	// Detect common error types and provide better messages
	let displayMessage = $derived.by(() => {
		if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
			return 'Unable to connect to the server. Please check your internet connection and try again.';
		}
		if (message.includes('timeout')) {
			return 'The request took too long. Please try again.';
		}
		return message;
	});

	let displayIcon = $derived.by(() => {
		if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
			return 'wifi_off';
		}
		if (message.includes('timeout')) {
			return 'schedule';
		}
		if (message.includes('401') || message.includes('Unauthorized')) {
			return 'lock';
		}
		if (message.includes('403') || message.includes('Forbidden')) {
			return 'block';
		}
		if (message.includes('404') || message.includes('Not found')) {
			return 'search_off';
		}
		return icon;
	});
</script>

<div class="card p-8 text-center">
	<div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
		<span class="material-icons text-3xl text-red-500">{displayIcon}</span>
	</div>
	<h3 class="text-lg font-medium text-surface-900 mb-2">{title}</h3>
	<p class="text-surface-500 mb-4 max-w-md mx-auto">{displayMessage}</p>
	{#if onRetry}
		<button class="btn btn-primary" onclick={onRetry}>
			<span class="material-icons text-sm">refresh</span>
			Try Again
		</button>
	{/if}
</div>
