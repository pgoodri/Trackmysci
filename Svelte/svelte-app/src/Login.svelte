<script>
    import { initializeApp } from "firebase/app";
    import {getAuth,signInWithEmailAndPassword,sendPasswordResetEmail,} from "firebase/auth";
    import { navigate } from "svelte-routing";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Label } from "$lib/components/ui/label/index.js";

    // Firebase Configuration
    const firebaseConfig = {
        apiKey: "AIzaSyCHdf8tVDVOtTazjvC0h1PyKwqNifWfqww",
        authDomain: "trackmysci.firebaseapp.com",
        projectId: "trackmysci",
        storageBucket: "trackmysci.appspot.com",
        messagingSenderId: "94634841161",
        appId: "1:94634841161:web:ded58b1dc49db1f1dc1b98",
        measurementId: "G-6JR45C2DBF",
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);

    // State variables
    let email = "";
    let password = "";
    let errorMessage = "";
    let resetMessage = "";
    let showForgotPassword = false; // Toggle between login and forgot password

    // Login Function
    async function handleLogin() {
        if (!email || !password) {
            errorMessage = "Please enter both email and password.";
            return;
        }

        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            navigate("/dashboard");
        } catch (error) {
            console.error("Login error:", error.message);
            errorMessage = error.message;
        }
    }

    // Forgot Password Function
    async function handleForgotPassword() {
        if (!email) {
            errorMessage = "Please enter your email to reset your password.";
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            resetMessage = "Password reset email sent! Please check your inbox.";
            errorMessage = "";
        } catch (error) {
            console.error("Reset password error:", error.message);
            errorMessage = error.message;
            resetMessage = "";
        }

        // Clear messages after 5 seconds
        setTimeout(() => {
            errorMessage = "";
            resetMessage = "";
        }, 5000);
    }
</script>

<div class="w-full lg:grid h-screen lg:grid-cols-2 xl:min-h-[800px]">
    <!-- Left Section: Form -->
    <div class="flex items-center justify-center py-12">
        <div class="mx-auto grid w-[350px] gap-6">
            {#if !showForgotPassword}
                <!-- Login Form -->
                <div class="grid gap-2 text-center">
                    <h1 class="text-3xl font-bold">Login</h1>
                    <p class="text-muted-foreground text-balance">
                        Enter your email below to login to your account
                    </p>
                </div>
                <div class="grid gap-4">
                    {#if errorMessage}
                        <p class="text-red-500 text-sm">{errorMessage}</p>
                    {/if}
                    <div class="grid gap-2">
                        <Label for="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="mdas@siue.edu"
                            bind:value={email}
                            required
                        />
                    </div>
                    <div class="grid gap-2">
                        <div class="flex items-center">
                            <Label for="password">Password</Label>
                            <button
                                type="button"
                                class="ml-auto inline-block text-sm underline text-blue-500"
                                on:click={() => (showForgotPassword = true)}
                            >
                                Forgot your password?
                            </button>
                        </div>
                        <Input
                            id="password"
                            type="password"
                            placeholder="Your password"
                            bind:value={password}
                            required
                        />
                    </div>
                    <Button
                        type="button"
                        class="w-full"
                        on:click={handleLogin}
                    >
                        Login
                    </Button>
                </div>
                <div class="mt-4 text-center text-sm">
                    Don&apos;t have an account?
                    <button
                        type="button"
                        class="underline cursor-pointer text-blue-500"
                        on:click={() => navigate('/signup')}
                    >
                        Sign up
                    </button>
                </div>
            {:else}
                <!-- Forgot Password Form -->
                <div class="grid gap-2 text-center">
                    <h1 class="text-3xl font-bold">Forgot Password</h1>
                    <p class="text-muted-foreground text-balance">
                        Enter your email to reset your password. We’ll send you a link to reset it.
                    </p>
                </div>
                <div class="grid gap-4">
                    {#if resetMessage}
                        <p class="text-green-500 text-sm">{resetMessage}</p>
                    {/if}
                    {#if errorMessage}
                        <p class="text-red-500 text-sm">{errorMessage}</p>
                    {/if}
                    <div class="grid gap-2">
                        <Label for="reset-email">Email</Label>
                        <Input
                            id="reset-email"
                            type="email"
                            placeholder="mdas@example.com"
                            bind:value={email}
                            required
                        />
                    </div>
                    <div class="flex justify-between">
                        <Button
                            type="button"
                            variant="outline"
                            on:click={() => (showForgotPassword = false)}
                        >
                            Back to Login
                        </Button>
                        <Button type="button" on:click={handleForgotPassword}>
                            Send Reset Email
                        </Button>
                    </div>
                </div>
            {/if}
        </div>
    </div>

    <!-- Right Section: Welcome Message -->
    <div class="hidden lg:flex flex-col items-center justify-center text-center bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 text-white p-12">
        <h1 class="text-4xl font-bold mb-4">Welcome to TrackMySci</h1>
        <p class="text-lg">
            Track your scientific readings and stay on top of your research goals.
        </p>
    </div>
</div>
