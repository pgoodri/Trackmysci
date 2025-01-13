// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCHdf8tVDVOtTazjvC0h1PyKwqNifWfqww",
    authDomain: "trackmysci.firebaseapp.com",
    projectId: "trackmysci",
    storageBucket: "trackmysci.appspot.com",
    messagingSenderId: "94634841161",
    appId: "1:94634841161:web:ded58b1dc49db1f1dc1b98",
    measurementId: "G-6JR45C2DBF",
};

// Initialize Firebase app and Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth, onAuthStateChanged };