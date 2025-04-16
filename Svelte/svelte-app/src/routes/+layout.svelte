<script>
  import "../app.css";
  import { Toaster, toast } from "svelte-sonner";
  import { onMount } from "svelte";
  
  onMount(() => {
    // Test toast to verify it's working
    setTimeout(() => {
      toast("Direct toast test!");
    }, 1000);
  });
</script>

<slot />
<Toaster richColors closeButton position="top-right" /> 