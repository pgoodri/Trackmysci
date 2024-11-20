<script>
    import { initializeApp } from 'firebase/app';
    import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from 'firebase/auth';
    import { userStore } from './userStore';
    import Dashboard from './Dashboard.svelte';
    import Library from './Library.svelte';
    import { Router, Route, navigate } from 'svelte-routing';

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

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);

    // State variables
    let email = $state('');
    let password = $state('');
    let isLoggedIn = $state(false);
    let user = $state(null);
    let errorMessage = $state('');
    let resetMessage = $state('');

    // Function to register
    async function register() {
        if (!email.endsWith('@siue.edu')) {
            errorMessage = 'Only @siue.edu emails are allowed to register.';
            return;
        }

        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(result.user); // Send verification email
            alert('Verification email sent! Please verify your account.');
        } catch (error) {
            console.error('Registration error:', error.message);
            errorMessage = error.message;
        }
    }

    // Function to log in
    async function login() {
        try {
            const result = await signInWithEmailAndPassword(auth, email, password);

            // Check if the email is verified
            if (!result.user.emailVerified) {
                errorMessage = 'Please verify your email before logging in.';
                signOut(auth); // Log out the user
                return;
            }

            user = result.user;
            userStore.set(user);
            isLoggedIn = true;
            navigate('/dashboard');
        } catch (error) {
            console.error('Login error:', error.message);
            errorMessage = error.message;
        }
    }

    // Function to send password reset email
    async function resetPassword() {
        try {
            if (!email) {
                errorMessage = 'Please enter your email to reset your password.';
                return;
            }
            await sendPasswordResetEmail(auth, email);
            resetMessage = 'Password reset email sent! Please check your inbox.';
        } catch (error) {
            console.error('Reset password error:', error.message);
            resetMessage = error.mes
        }

        // Clear the message after 5 seconds
        setTimeout(() => {
            resetMessage = '';
        }, 5000);
    }

    // Function to log out
    function logout() {
        signOut(auth)
            .then(() => {
                user = null;
                userStore.set(null);
                isLoggedIn = false;
                navigate('/');
            })
            .catch((error) => console.error('Logout error:', error));
    }

    // Track authentication state changes
    onAuthStateChanged(auth, (authUser) => {
        if (authUser) {
            user = authUser;
            isLoggedIn = true;
        } else {
            user = null;
            isLoggedIn = false;
        }
    });
</script>

<div class="container">
    {#if !isLoggedIn}
        <div class="welcome-message">
            <h1>Welcome to Track My Sci!</h1>
            <p>A place to track your scientific reading.</p>

            <!-- Error message -->
            {#if errorMessage}
                <p class="error">{errorMessage}</p>
            {/if}

            <!-- Registration Form -->
            <h3>Register</h3>
            <input type="email" placeholder="Email (must end with @siue.edu)" bind:value={email} />
            <input type="password" placeholder="Password" bind:value={password} />
            <button onclick={register}>Register</button>

            <!-- Login Form -->
            <h3>Login</h3>
            <input type="email" placeholder="Email" bind:value={email} />
            <input type="password" placeholder="Password" bind:value={password} />
            <div class="button-group">
                <button onclick={login}>Login</button>
                <button onclick={resetPassword} class="forgot-password-button">Forgot Password?</button>
            </div>

            <!-- Reset message -->
            {#if resetMessage}
                <p class="reset-message">{resetMessage}</p>
            {/if}
        </div>
    {:else}
        <div class="logged-in">
            <h1>Welcome, {user.email}!</h1>
            <button onclick={logout}>Return to Sign In</button>
        </div>
    {/if}
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

    .welcome-message, .logged-in {
        text-align: center;
    }

    .error {
        color: red;
        margin-bottom: 10px;
    }

    .reset-message {
        color: green;
        margin-top: 10px;
    }

    input {
        width: 100%;
        padding: 10px;
        margin-bottom: 10px;
        border-radius: 5px;
        border: 1px solid #ddd;
    }

    .button-group {
        display: flex;
        gap: 10px;
    }

    button {
        padding: 10px 20px;
        background-color: #007bff;
        border: none;
        border-radius: 5px;
        color: white;
        cursor: pointer;
    }

    button:hover {
        background-color: #0056b3;
    }

    .forgot-password-button {
        background-color: #6c757d;
    }

    .forgot-password-button:hover {
        background-color: #5a6268;
    }
</style>