<script>
    const redirectToLogin = () => {
      // Redirect to the login page
      window.location.href = '/login';
    };
  </script>
  
  <main class="flex flex-col items-center justify-center h-screen text-center">
    <h1 class="text-4xl font-bold">Welcome to TrackMySci</h1>
    <p class="mt-4 text-lg">Your ultimate tool for tracking and managing your scientific literature.</p>
    <button class="mt-8 px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600" on:click={redirectToLogin}>
      Login
    </button>
  </main>
  