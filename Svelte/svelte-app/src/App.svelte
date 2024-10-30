<script>
    import { Router, Route, navigate } from 'svelte-routing';
    import { onMount } from 'svelte';
    import Landing from './pages/Landing.svelte';
    import Login from './pages/Login.svelte';
    import Dashboard from './pages/Dashboard.svelte';

    // Redirect to `/landing` on initial load
    onMount(() => {
        navigate('/login');
    });
</script>


<Router>
    <div class="page-container">
        <Route path="/landing" component={Landing} />
        <Route path="/login" component={Login} />
        <Route path="/dashboard" component={Dashboard} />
    </div>
</Router>
