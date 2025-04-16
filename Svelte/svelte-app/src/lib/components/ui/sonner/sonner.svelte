<script>
	import { Toaster as Sonner } from "svelte-sonner";
	import { mode } from "mode-watcher";
</script>

<Sonner
	theme={$mode}
	richColors
	expand={true}
	position="top-right"
	closeButton={true}
	class="toaster group !z-[1000]"
	toastOptions={{
		classes: {
			toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:z-[1000]",
			description: "group-[.toast]:text-muted-foreground",
			actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
			cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
		},
	}}
	{...$$restProps}
/>
