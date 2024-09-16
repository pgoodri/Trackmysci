// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'; 
let analytics; // Declare analytics variable

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCHdf8tVDVOtTazjvC0h1PyKwqNifWfqww",
  authDomain: "trackmysci.firebaseapp.com",
  projectId: "trackmysci",
  storageBucket: "trackmysci.appspot.com",
  messagingSenderId: "94634841161",
  appId: "1:94634841161:web:ded58b1dc49db1f1dc1b98",
  measurementId: "G-6JR45C2DBF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Conditionally initialize Firebase Analytics if running in the browser
if (typeof window !== "undefined") {
  const { getAnalytics } = await import("firebase/analytics");
  analytics = getAnalytics(app);
}

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

// Functions to handle login and logout
export const loginWithGoogle = () => {
  return signInWithPopup(auth, provider);
};

export const logout = () => {
  return signOut(auth);
};

export { analytics }; // Export analytics if you need it elsewhere
