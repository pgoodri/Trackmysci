<script>
    import { Router, Route, navigate } from 'svelte-routing';
    import Success from './Success.svelte';

    function testNavigate() {
		console.log("Navigating to success page");
    	navigate('/success');
    	console.log("Navigate function called");
    }
</script>

<Router>
    <main>
        <h1>Welcome!</h1>
        <button on:click={testNavigate}>Go to Success</button>
    </main>

    <Route path="/success" component={Success} />
</Router>