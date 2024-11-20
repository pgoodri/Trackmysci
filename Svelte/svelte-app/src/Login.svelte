<script>
    import { navigate } from "svelte-routing";
    import { initializeApp } from "firebase/app";
    import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
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

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);

    // Form State
    let email = "";
    let password = "";
    let errorMessage = "";

    // Function to handle login
    async function handleLogin() {
        if (!email || !password) {
            errorMessage = "Please enter both email and password.";
            return;
        }

        try {
            const result = await signInWithEmailAndPassword(auth, email, password);

            // Example: Log user details to console
            console.log("User signed in:", result.user);

            // Navigate to the dashboard or another page
            navigate("/dashboard");
        } catch (error) {
            console.error("Login error:", error.message);
            errorMessage = error.message;
        }
    }

    // Function to handle Google login (not yet implemented)
    function handleGoogleLogin() {
        alert("Google login integration not yet implemented.");
        // Add your Google login logic here.
    }
</script>

<div class="w-full lg:grid lg:min-h-[600px] lg:grid-cols-2 xl:min-h-[800px]">
    <!-- Login Form Section -->
    <div class="flex items-center justify-center py-12">
        <div class="mx-auto grid w-[350px] gap-6">
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

                <!-- Email Input -->
                <div class="grid gap-2">
                    <Label for="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="m@example.com"
                        bind:value={email}
                        required
                    />
                </div>

                <!-- Password Input -->
                <div class="grid gap-2">
                    <div class="flex items-center">
                        <Label for="password">Password</Label>
                        <a href="##" class="ml-auto inline-block text-sm underline">
                            Forgot your password?
                        </a>
                    </div>
                    <Input
                        id="password"
                        type="password"
                        bind:value={password}
                        required
                    />
                </div>

                <!-- Login Buttons -->
                <Button
                    type="button"
                    class="w-full"
                    on:click={handleLogin}
                >
                    Login
                </Button>
            </div>

            <!-- Sign-Up Redirect -->
            <div class="mt-4 text-center text-sm">
                Don&apos;t have an account?
                <a href="/signup" class="underline"> Sign up </a>
            </div>
        </div>
    </div>

    <!-- Right Section: Image -->
    <div class="bg-muted hidden lg:block">
        <img
            src="/images/placeholder.svg"
            alt="placeholder"
            width="1920"
            height="1080"
            class="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
    </div>
</div>
