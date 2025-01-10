<script>
    import { initializeApp } from "firebase/app";
    import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, updateProfile, signOut } from "firebase/auth";
    import { navigate } from "svelte-routing";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import * as Dialog from "$lib/components/ui/dialog/index.js";

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
    let firstName = "";
    let lastName = "";
    let email = "";
    let password = "";
    let errorMessage = "";
    let dialogVisible = false;
    let isVerifying = false; // Spinner state
    let isVerified = false; // Checkmark state

    let verificationCheckInterval;

    // Handle Sign Up
    async function handleSignUp() {
        if (!firstName || !lastName || !email || !password) {
            errorMessage = "All fields are required!";
            return;
        }

        if (!email.endsWith("@siue.edu")) {
            errorMessage = "Only @siue.edu email addresses are allowed!";
            return;
        }

        try {
            // Create user
            const result = await createUserWithEmailAndPassword(auth, email, password);

            // Update the user profile with the first and last name
            await updateProfile(result.user, {
                displayName: `${firstName} ${lastName}`,
            });

            // Send a verification email
            await sendEmailVerification(result.user);

            // Show dialog and clear form
            dialogVisible = true;
            isVerifying = true;
            startVerificationPolling();
            errorMessage = "";
        } catch (error) {
            console.error("Error during sign up:", error.message);
            errorMessage = error.message;
        }
    }

    // Start Verification Polling
    function startVerificationPolling() {
        verificationCheckInterval = setInterval(async () => {
            try {
                const user = auth.currentUser;
                if (!user) return;

                await user.reload(); // Refresh user data
                if (user.emailVerified) {
                    isVerifying = false;
                    isVerified = true;
                    clearInterval(verificationCheckInterval); // Stop polling
                    setTimeout(() => {
                        dialogVisible = false;
                        navigate("/dashboard");
                    }, 1500); // Redirect after a delay
                }
            } catch (error) {
                console.error("Error checking verification status:", error.message);
            }
        }, 3000); // Poll every 3 seconds
    }

    // Logout User
    function handleLogout() {
        signOut(auth)
            .then(() => {
                clearInterval(verificationCheckInterval);
                dialogVisible = false;
                navigate("/login");
            })
            .catch((error) => console.error("Error signing out:", error.message));
    }
</script>

<div class="flex items-center justify-center min-h-screen bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500">
    <div class="w-full max-w-md bg-white p-6 rounded-lg shadow-md">
        <h1 class="text-xl font-bold mb-4">Sign Up</h1>
        <p class="text-gray-700 mb-6">Enter your information to create an account.</p>

        {#if errorMessage}
            <p class="text-red-500 text-sm mb-4">{errorMessage}</p>
        {/if}

        <form on:submit|preventDefault={handleSignUp} class="grid gap-4">
            <!-- First and Last Name -->
            <div class="grid grid-cols-2 gap-4">
                <div class="grid gap-2">
                    <Label for="first-name">First name</Label>
                    <Input id="first-name" bind:value={firstName} required />
                </div>
                <div class="grid gap-2">
                    <Label for="last-name">Last name</Label>
                    <Input id="last-name" bind:value={lastName} required />
                </div>
            </div>

            <!-- Email -->
            <div class="grid gap-2">
                <Label for="email">Email</Label>
                <Input id="email" type="email" placeholder="mdas@siue.com" bind:value={email} required />
            </div>

            <!-- Password -->
            <div class="grid gap-2">
                <Label for="password">Password</Label>
                <Input id="password" type="password" bind:value={password} required />
            </div>

            <!-- Submit Button -->
            <Button type="submit" class="w-full">Create an account</Button>

            <div class="mt-4 text-center text-sm">
                Already have an account?
                <button
                    type="button"
                    class="underline cursor-pointer text-blue-500"
                    on:click={() => navigate('/login')}
                >
                    Login
                </button>
            </div>
        </form>
    </div>
</div>

<!-- Email Verification Dialog -->
<Dialog.Root open={dialogVisible}>
    <Dialog.Trigger class="hidden" />
    <Dialog.Content>
        <Dialog.Header>
            <Dialog.Title>Verify Your Email</Dialog.Title>
            <Dialog.Description>
                We have sent a verification email to <strong>{email}</strong>. Please check your inbox.
            </Dialog.Description>
        </Dialog.Header>

        <!-- Spinner and Success Checkmark -->
        {#if isVerifying}
            <div class="flex justify-center items-center mt-4">
                <div class="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
        {:else if isVerified}
            <div class="flex justify-center items-center mt-4 text-green-500">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span class="ml-2">Email Verified!</span>
            </div>
        {/if}

        <div class="mt-4 flex flex-col gap-4">
            <Button variant="outline" on:click={handleLogout}>Log Out</Button>
        </div>
    </Dialog.Content>
</Dialog.Root>