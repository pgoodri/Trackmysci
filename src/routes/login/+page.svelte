<script>
    import { loginWithGoogle } from '$lib/firebase';
  
    const handleLogin = async () => {
      try {
        await loginWithGoogle();
        // Redirect to the dashboard after successful login
        window.location.href = '/dashboard';
      } catch (error) {
        console.error('Error logging in:', error);
      }
    };
  </script>
  
  <main class="flex flex-col items-center justify-center h-screen text-center">
    <h1 class="text-4xl font-bold">Login to TrackMySci</h1>
    <button class="mt-8 px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600" on:click={handleLogin}>
      Login with Google
    </button>
  </main>
  