<script>
  import "../app.css";
  import { Toaster, toast } from "$lib/components/ui/sonner";
  import { onMount } from "svelte";
  
  onMount(() => {
    // Test toast to verify it's working
    setTimeout(() => {
      toast("Toast test: If you see this, toasts are working!");
    }, 1000);
  });
</script>

<slot />
<Toaster richColors closeButton position="top-right" /> 