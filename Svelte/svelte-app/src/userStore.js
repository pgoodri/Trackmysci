import { writable } from 'svelte/store';

export const userStore = writable(null); // Store to hold logged-in user data