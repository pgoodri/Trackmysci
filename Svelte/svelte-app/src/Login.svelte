<script>
    import { initializeApp } from 'firebase/app';
    import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
    import { userStore } from './userStore';
    import Dashboard from './Dashboard.svelte';
    import Library from './Library.svelte';
    import { Router, Route, navigate } from 'svelte-routing';
    import { firebaseConfig } from './firebaseConfig';

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();

    // Variables for User Authentication
    let user = "User";
    let isLoggedIn = false;

    // Google Authentication Functions
    async function login() {
        try {
            const result = await signInWithPopup(auth, provider);
            const loggedInUser = result.user;
            user = loggedInUser.displayName || "User";
            userStore.set(loggedInUser);
            isLoggedIn = true;
            navigate('/dashboard');
        } catch (error) {
            console.error("Login error:", error);
        }
    }

    function logout() {
        signOut(auth).then(() => {
            user = "User";
            userStore.set(null);
            isLoggedIn = false;
        }).catch(error => console.error("Logout error:", error));
    }

    onAuthStateChanged(auth, (authUser) => {
        if (authUser) {
            user = authUser.displayName || "User";
            userStore.set(authUser);
            isLoggedIn = true;
        } else {
            user = "User";
            userStore.set(null);
            isLoggedIn = false;
        }
    });
</script>


    <div class="container">
            <div class="welcome-message">
                <h1>Welcome to Track My Sci!</h1>
                <p>A place to track your scientific reading.</p>
                <button on:click={login}>Login with Google</button>
            </div>
    </div>


<style>
    .container {
        display: flex;
        flex-direction: column;
        padding: 20px;
        font-family: Arial, sans-serif;
        height: 100vh;
        justify-content: center;
        align-items: center;
        background: linear-gradient(135deg, #ff7e5f, #feb47b);
        color: white;
    }

    .welcome-message {
        text-align: center;
    }
</style>
