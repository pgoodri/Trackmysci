<script>
    import "./app.css";
    import { Router, Route, navigate } from 'svelte-routing';
    import Dashboard from './Dashboard.svelte';
    import Library from './Library.svelte';
    import Login from './Login.svelte';
    import Signup from './Signup.svelte';
    import Verify from './Verify.svelte';
    import { initializeApp } from 'firebase/app';
    import { onMount } from 'svelte';
    
    // Redirect to `/login` on initial load
    onMount(() => {
        navigate('/signup');
    });
</script>


<Router>
    <div class="page-container">
        <Route path="/" component={Signup} />
        <Route path="/signup" component={Signup} />
        <Route path="/login" component={Login} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/library" component={Library} />
        <Route path="/verify" component={Verify} />
    </div>
</Router>
