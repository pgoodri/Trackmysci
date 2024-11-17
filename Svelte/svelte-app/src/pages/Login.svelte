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

    async function login() {
        try {
            const result = await signInWithPopup(auth, provider);
            userStore.set(result.user);
            console.log("User logged in:", result.user);
            navigate('/dashboard');
        } catch (error) {
            console.error("Login error:", error);
        }
    }

    // Dummy function for email login
    function dummyEmailLogin() {
        alert("Email login is not functional yet.");
    }

    function goToSignup() {
        navigate('/signup');
    }
</script>

<div class="login-page">
    <!-- Left Side -->
    <div class="welcome-section">
        <h1>Welcome to Track My Sci!</h1>
        <p>Track your scientific readings and stay on top of your research goals.</p>
    </div>

    <!-- Right Side: Login Form -->
    <div class="login-section">
        <div class="login-box">
            <button class="google-signin-button" onclick={login}>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" />
                <span>Continue with Google</span>
            </button>

            <!-- Dummy Email Sign-In -->
            <div class="email-signin">
                <input type="email" placeholder="Email"/>
                <input type="password" placeholder="Password"/>
                <button class="email-signin-button" onclick={dummyEmailLogin}>Sign in with Email</button>
            </div>

            <p class="signup-prompt">
                Don't have an account? <button class="signup-link" onclick={goToSignup}>Sign up</button>
            </p>

        </div>
    </div>
</div>

<style>

    .login-page {
        display: flex;
        height: 100vh;
        font-family: Arial, sans-serif;
    }

    .welcome-section {
        flex: 1;
        background: linear-gradient(135deg, #ff7e5f, #feb47b);
        color: white;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 40px;
        text-align: center;
    }

    .welcome-section h1 {
        font-size: 2.5rem;
        margin-bottom: 10px;
    }

    .welcome-section p {
        font-size: 1.2rem;
        max-width: 400px;
        line-height: 1.5;
    }

    .login-section {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
        background-color: white;
    }

    .login-box {
        width: 100%;
        max-width: 400px;
        padding: 20px;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        display: flex;
        flex-direction: column;
        gap: 15px;
    }

    .google-signin-button {
        display: flex;
        align-items: center;
        padding: 10px 15px;
        background-color: white;
        color: #757575;
        border: 1px solid #d9d9d9;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 500;
        box-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
        transition: background-color 0.3s, box-shadow 0.3s;
    }

    .google-signin-button:hover {
        background-color: #f7f7f7;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .google-signin-button img {
        width: 20px;
        height: 20px;
        margin-right: 10px;
    }

    .google-signin-button span {
        color: #757575;
    }

    .email-signin {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .email-signin input {
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 16px;
        background-color: #f5f5f5;
        cursor: not-allowed;
    }

    .email-signin-button {
        padding: 10px 15px;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 16px;
        cursor: pointer;
        transition: background-color 0.3s;
    }

    .email-signin-button:hover {
        background-color: #0056b3;
    }

    .signup-prompt {
        font-size: 0.9rem;
        align-items: center;
        text-align: center;
    }

    .signup-link {
        background: none;
        border: none;
        color: #007bff;
        cursor: pointer;
        font-size: 0.9rem;
        padding: 0;
    }

    .signup-link:hover {
        color: #0056b3;
    }
</style>

