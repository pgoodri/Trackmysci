import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";


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
const db = getFirestore(app);

export { db };
