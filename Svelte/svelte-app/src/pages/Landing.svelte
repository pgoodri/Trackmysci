
<script>
    import { navigate } from 'svelte-routing';

    function goToLogin() {
        navigate('/login');
    }
</script>

<div class="landing-page">
    <h1>Welcome to Track My Sci</h1>
    <p>Your place to track scientific readings.</p>
    <button on:click={goToLogin}>Get Started</button>
</div>


<style>
    .landing-page {
        text-align: center;
        margin-top: 100px;
    }

    button {
        padding: 10px 20px;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
    }

    button:hover {
        background-color: #0056b3;
    }
</style>