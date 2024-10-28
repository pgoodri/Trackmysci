<script>
    import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
    import { initializeApp } from 'firebase/app';
    import { userStore } from '../userStore';
    import { navigate } from 'svelte-routing';  // Import navigate for routing

    // Initialize Firebase
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

    // Login function
    async function login() {
        try {
            const result = await signInWithPopup(auth, provider);
            userStore.set(result.user);  // Store the user information
            console.log("User logged in:", result.user);

            // Redirect to dashboard after successful login
            navigate('/dashboard');
        } catch (error) {
            console.error("Login error:", error);
        }
    }
</script>

<div class="login-page">
    <h1>Login to Track My Sci</h1>
    <button on:click={login}>Login with Google</button>
</div>

<style>
    .login-page {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100vh;
        font-family: Arial, sans-serif;
        text-align: center;
        background: linear-gradient(135deg, #ff7e5f, #feb47b);
    }

    button {
        padding: 10px 20px;
        margin-top: 20px;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
    }

    button:hover {
        background-color: #0056b3;
    }
</style>
