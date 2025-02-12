// src/firebase.js
import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth and Firestore
export const auth = getAuth(app);
export const firestore = getFirestore(app);

// Set persistence to local (this is the default, but we set it explicitly)
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("Auth persistence set to local.");
  })
  .catch((error) => {
    console.error("Error setting auth persistence:", error.message);
  });
