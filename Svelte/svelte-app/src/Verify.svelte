<script>
    import { navigate } from "svelte-routing";
    import { getAuth, sendEmailVerification, signOut } from "firebase/auth";
    import { Button } from "$lib/components/ui/button/index.js";

    // Firebase Auth
    const auth = getAuth();

    let email = auth.currentUser?.email || "your email";
    let successMessage = "";
    let errorMessage = "";

    // Resend verification email
    async function resendVerificationEmail() {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error("No authenticated user found.");

            await sendEmailVerification(user);
            successMessage = "Verification email sent! Please check your inbox.";
            errorMessage = "";
        } catch (error) {
            console.error("Error resending email:", error.message);
            successMessage = "";
            errorMessage = "Failed to resend verification email.";
        }
    }

    // Logout user
    function handleLogout() {
        signOut(auth)
            .then(() => {
                navigate("/login");
            })
            .catch((error) => console.error("Error signing out:", error.message));
    }
</script>

<div class="flex items-center justify-center min-h-screen bg-gray-100">
    <div class="max-w-md w-full bg-white p-6 rounded-lg shadow-md text-center">
        <h1 class="text-2xl font-bold mb-4">Verify Your Email</h1>
        <p class="text-gray-700 mb-6">
            We've sent a verification link to <span class="font-medium">{email}</span>. Please check your inbox to verify your email address before continuing.
        </p>

        {#if successMessage}
            <p class="text-green-500 mb-4">{successMessage}</p>
        {/if}
        {#if errorMessage}
            <p class="text-red-500 mb-4">{errorMessage}</p>
        {/if}

        <div class="flex flex-col gap-4">
            <Button class="w-full" on:click={resendVerificationEmail}>
                Resend Verification Email
            </Button>
            <Button variant="outline" class="w-full" on:click={handleLogout}>
                Log Out
            </Button>
        </div>
    </div>
</div>
