<script>
    import { initializeApp } from "firebase/app";
    import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from "firebase/auth";
    import { navigate } from "svelte-routing";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import * as Card from "$lib/components/ui/card/index.js";

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

    async function handleSignUp() {
        if (!firstName || !lastName || !email || !password) {
            errorMessage = "All fields are required!";
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

            alert("Account created successfully! Please verify your email.");
            navigate("/login"); // Redirect to the login page
        } catch (error) {
            console.error("Error during sign up:", error.message);
            errorMessage = error.message;
        }
    }
</script>


<div class="flex items-center justify-center min-h-screen bg-gray-100">
    <Card.Root class="w-full max-w-md mx-auto p-4 bg-white rounded-lg shadow-md">
        <Card.Header>
            <Card.Title class="text-xl">Sign Up</Card.Title>
            <Card.Description>
                Enter your information to create an account
            </Card.Description>
        </Card.Header>
        <Card.Content>
            {#if errorMessage}
                <p class="text-red-500 text-sm mb-4">{errorMessage}</p>
            {/if}
            <form on:submit|preventDefault={handleSignUp} class="grid gap-4">
                <!-- First and Last Name -->
                <div class="grid grid-cols-2 gap-4">
                    <div class="grid gap-2">
                        <Label for="first-name">First name</Label>
                        <Input
                            id="first-name"
                            bind:value={firstName}
                            required
                        />
                    </div>
                    <div class="grid gap-2">
                        <Label for="last-name">Last name</Label>
                        <Input
                            id="last-name"
                            bind:value={lastName}
                            required
                        />
                    </div>
                </div>

                <!-- Email -->
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

                <!-- Password -->
                <div class="grid gap-2">
                    <Label for="password">Password</Label>
                    <Input
                        id="password"
                        type="password"
                        bind:value={password}
                        required
                    />
                </div>

                <!-- Submit Button -->
                <Button type="submit" class="w-full">Create an account</Button>
            </form>
            <div class="mt-4 text-center text-sm">
                Already have an account?
                <a href="/login" class="underline"> Sign in </a>
            </div>
        </Card.Content>
    </Card.Root>
</div>
