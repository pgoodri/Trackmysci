<script>
    import { Router, Route, navigate } from 'svelte-routing';
    import { onMount } from 'svelte';
    import Login from './pages/Login.svelte';
    import Dashboard from './pages/Dashboard.svelte';
    import Library from './pages/Library.svelte';

    // Redirect to `/login` on initial load
    onMount(() => {
        navigate('/login');
    });
</script>


<Router>
    <div class="page-container">
        <Route path="/login" component={Login} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/library" component={Library} />
    </div>
</Router>
