import App from './App.svelte';
import { Router } from 'svelte-routing';

const app = new App({
    target: document.body,
    props: {
        Router // Pass Router as a prop if needed
    }
});

export default app;