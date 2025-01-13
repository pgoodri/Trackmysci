import { writable } from "svelte/store";
import { auth, onAuthStateChanged } from "./firebase";

export const userStore = writable(null);

// Track authentication state
onAuthStateChanged(auth, (user) => {
    if (user) {
        userStore.set(user); // Set the user in the store
    } else {
        userStore.set(null); // Clear the user when logged out
    }
});
