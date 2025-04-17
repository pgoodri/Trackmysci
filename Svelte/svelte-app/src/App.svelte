<script>
    import "./app.css";
    import { Router, Route, navigate } from 'svelte-routing';
    import Dashboard from './Dashboard.svelte';
    import Library from './Library.svelte';
    import Analytics from './Analytics.svelte';
    import Login from './Login.svelte';
    import Signup from './Signup.svelte';
    import { initializeApp } from 'firebase/app';
    import { onMount } from 'svelte';
    import { auth, firestore } from "./firebase";
    import { Toaster } from 'svelte-french-toast';
    
</script>


<Router>
    <div class="page-container">
        <Route path="/" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/login" component={Login} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/library" component={Library} />
        <Route path="/analytics" component={Analytics} />
    </div>
</Router>

<!-- Global toast notifications -->
<Toaster />
