<script>
    import "./app.css";
    import { Router, Route, navigate } from 'svelte-routing';
    import { onMount } from 'svelte';
    import Login from './pages/Login.svelte';
    import Dashboard from './pages/Dashboard.svelte';
    import Library from './pages/Library.svelte';
    import TailwindCSS from './TailwindCSS.svelte';
    import NewDashboard from './pages/NewDashboard.svelte';
    
    // Redirect to `/login` on initial load
    onMount(() => {
        navigate('/login');
    });
</script>
<TailwindCSS />

<Router>
    <div class="page-container">
        <Route path="/login" component={Login} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/library" component={Library} />
        <Route path="/newdashboard" component={NewDashboard} />
    </div>
</Router>
