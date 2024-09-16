<script>
    import { auth, logout } from '$lib/firebase';
  
    let user = auth.currentUser;
  
    const handleLogout = async () => {
      try {
        await logout();
        window.location.href = '/'; // Redirect to home page after logout
      } catch (error) {
        console.error('Error logging out:', error);
      }
    };
  </script>
  
  <main class="flex flex-col items-center justify-center h-screen text-center">
    <h1 class="text-4xl font-bold">Dashboard</h1>
    <p>Welcome, {user?.displayName}!</p>
    <p>Email: {user?.email}</p>
    <button class="mt-8 px-6 py-3 bg-red-500 text-white rounded hover:bg-red-600" on:click={handleLogout}>
      Logout
    </button>
  </main>
  
  <style>
    main {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      text-align: center;
    }
  
    button {
      margin-top: 20px;
      padding: 10px 20px;
      font-size: 16px;
      cursor: pointer;
    }
  </style>
  