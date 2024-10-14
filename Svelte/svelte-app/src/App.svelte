<script>
    import { Router, Route, navigate } from 'svelte-routing';
    import Success from './Success.svelte';
    import { initializeApp } from 'firebase/app';
    import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
    import { userStore } from './userStore';

    // Firebase configuration
    const firebaseConfig = {
        apiKey: "AIzaSyCHdf8tVDVOtTazjvC0h1PyKwqNifWfqww",
        authDomain: "trackmysci.firebaseapp.com",
        projectId: "trackmysci",
        storageBucket: "trackmysci.appspot.com",
        messagingSenderId: "94634841161",
        appId: "1:94634841161:web:ded58b1dc49db1f1dc1b98",
        measurementId: "G-6JR45C2DBF"
    };

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();

    let user = "User"; // Default user name
    let isLoggedIn = false; // Track login state

    // Login function using Google Popup
    async function login() {
        try {
            const result = await signInWithPopup(auth, provider);
            const loggedInUser = result.user;
            console.log("Login successful:", loggedInUser);

            user = loggedInUser.displayName || "User"; // Set user name
            userStore.set(loggedInUser); // Store the user
            isLoggedIn = true;
            navigate('/success'); // Redirect to success page
        } catch (error) {
            console.error("Login error:", error);
        }
    }

    // Logout function
    function logout() {
        signOut(auth)
            .then(() => {
                console.log("User signed out");
                user = "User";
                userStore.set(null);
                isLoggedIn = false;
            })
            .catch((error) => {
                console.error("Logout error:", error);
            });
    }

    // Monitor authentication state changes
    onAuthStateChanged(auth, (authUser) => {
        if (authUser) {
            user = authUser.displayName || "User"; // Update user name
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
        <!-- Greeting -->
        <div class="greeting">Hello, {user}!</div>

        <!-- Login and Logout buttons -->
        <div class="buttons">
            {#if isLoggedIn}
                <button on:click={logout}>Logout</button>
            {:else}
                <button on:click={login}>Login</button>
                <button>Sign Up</button> <!-- Placeholder Signup -->
            {/if}
        </div>

        <!-- Oval elements and rectangle -->
        <div class="oval-container">
            <div class="ovals">
                <div class="oval"></div>
                <div class="oval"></div>
                <div class="oval"></div>
                <div class="oval"></div>
                <div class="oval"></div>
            </div>

            <!-- Rectangle with rounded edges -->
            <div class="rectangle">
                Welcome to TrackMySci!
            </div>
        </div>
    </div>

    <Route path="/success" component={Success} />
</Router>

<style>
    .container {
        display: flex;
        flex-direction: column;
        padding: 20px;
        font-family: Arial, sans-serif;
        position: relative;
        height: 100vh;
    }

    .greeting {
        font-size: 24px;
        font-weight: bold;
        position: absolute;
        top: 20px;
        left: 20px;
    }

    .buttons {
        position: absolute;
        top: 20px;
        right: 20px;
    }

    .buttons button {
        padding: 10px 20px;
        font-size: 16px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        background-color: #007bff;
        color: white;
        margin-left: 10px;
    }

    .buttons button:hover {
        background-color: #0056b3;
    }

    .oval-container {
        margin-top: 80px;
        display: flex;
        flex-direction: row;
        gap: 20px;
        width: 100%;
    }

    .ovals {
        display: flex;
        flex-direction: column;
        gap: 20px;
        width: 50%;
    }

    .oval {
        height: 100px;
        background-color: lightgray;
        border-radius: 20px;
        text-align: center;
        line-height: 100px;
    }

    .rectangle {
        background-color: lightcoral;
        width: 50%;
        border-radius: 20px;
        display: flex;
        justify-content: center;
        align-items: center;
        text-align: center;
        font-size: 20px;
    }
</style>