import './global.css';
import App from './App.svelte';
import { Router } from 'svelte-routing';
import { mount } from "svelte";

const app = mount(App, {
    target: document.body,
    props: {
        Router // Pass Router as a prop if needed
    }
});

export default app;