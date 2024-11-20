<script>
    import { Router, Route, navigate } from 'svelte-routing';
    import Dashboard from './Dashboard.svelte';
    import Library from './Library.svelte';
    import Login from './Login.svelte';
    import { initializeApp } from 'firebase/app';
    import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
    import { userStore } from './userStore';
    import { getFirestore, collection, getDocs, addDoc, setDoc, doc } from 'firebase/firestore';
    import { onMount } from 'svelte';

    // Redirect to `/login` on initial load
    onMount(() => {
        navigate('/login');
    });
</script>

<Router>
    <div class="page-container">
        <Route path="/" component={Login} />
        <Route path="/login" component={Login} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/library" component={Library} />
    </div>
</Router>