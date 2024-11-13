<script>
    import { Router, Route, navigate } from 'svelte-routing';
    import Dashboard from './Dashboard.svelte';
    import Library from './Library.svelte';
    import { initializeApp } from 'firebase/app';
    import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
    import { userStore } from './userStore';

    // Firebase Configuration
    const firebaseConfig = {
        apiKey: "AIzaSyCHdf8tVDVOtTazjvC0h1PyKwqNifWfqww",
        authDomain: "trackmysci.firebaseapp.com",
        projectId: "trackmysci",
        storageBucket: "trackmysci.appspot.com",
        messagingSenderId: "94634841161",
        appId: "1:94634841161:web:ded58b1dc49db1f1dc1b98",
        measurementId: "G-6JR45C2DBF"
    };

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

<Router>
    <div class="container">
        {#if isLoggedIn}
            <div class="header">
                <div class="greeting">Welcome, {user}!</div>
                <div class="buttons">
                    <button on:click={logout}>Logout</button>
                </div>
            </div>

            <Route path="/dashboard" component={Dashboard} />
            <Route path="/library" component={Library} />
        {:else}
            <div class="welcome-message">
                <h1>Welcome to Track My Sci!</h1>
                <p>A place to track your scientific reading.</p>
                <button on:click={login}>Login with Google</button>
            </div>
        {/if}
    </div>
</Router>

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

    .header {
        position: absolute;
        top: 20px;
        width: 100%;
        display: flex;
        justify-content: space-between;
    }

    .greeting {
        font-size: 24px;
        margin-left: 20px;
    }

    .buttons button {
        padding: 10px 20px;
        background-color: #007bff;
        border: none;
        border-radius: 5px;
        color: white;
        cursor: pointer;
        margin-right: 20px;
    }

    .buttons button:hover {
        background-color: #0056b3;
    }

    .welcome-message {
        text-align: center;
    }
</style>
