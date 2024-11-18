<script>
    import { Router, Route, navigate } from 'svelte-routing';
    import Dashboard from './Dashboard.svelte';
    import Library from './Library.svelte';
    import Login from './Login.svelte';
    import { initializeApp } from 'firebase/app';
    import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
    import { userStore } from './userStore';
    import { getFirestore, collection, getDocs, addDoc, setDoc, doc } from 'firebase/firestore';
    import { onMount } from 'svelte';

    // Firebase Configuration
    const firebaseConfig = {
        apiKey: "AIzaSyCHdf8tVDVOtTazjvC0h1PyKwqNifWfqww",
        authDomain: "trackmysci.firebaseapp.com",
        projectId: "trackmysci",
        storageBucket: "trackmysci.appspot.com",
        messagingSenderId: "94634841161",
        appId: "1:94634841161:web:ded58b1dc49db1f1dc1b98",
        measurementId: "G-6JR45C2DBF"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();

    // Configure Firestore
    const db = getFirestore(app);
    const colRef = collection(db, 'user')
    getDocs(colRef).then((snapshot) => {
        let user = []
        snapshot.docs.forEach((doc) => {
            user.push({ ...doc.data(), id: doc.id })
        })
        console.log(user)
    }).catch((error) => { 
        console.log(error.message)
    });


    // Variables for User and Literature Management
    let user = "User";
    let isLoggedIn = false;
    let literatureList = [];
    let title = "";
    let author = "";
    let isbn = "";
    let comment = "";

    // Google Authentication Functions
    async function login() {
    try {
        const result = await signInWithPopup(auth, provider);
        const loggedInUser = result.user;
        user = loggedInUser.displayName || "User";
        userStore.set(loggedInUser);
        isLoggedIn = true;

        // Define the reference to the users collection
        const usersCollectionRef = collection(db, 'user');

        // Check if the user exists in Firestore
        const userDocRef = doc(usersCollectionRef, loggedInUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            // User does not exist, so add them to Firestore
            await addDoc(usersCollectionRef, {
                uid: loggedInUser.uid,
                name: loggedInUser.displayName,
                email: loggedInUser.email,
                photoURL: loggedInUser.photoURL,
                createdAt: new Date() // Optional: add creation date
            });
            console.log("New user added to Firestore!");
        } else {
            console.log("User already exists in Firestore.");
        }

        navigate('/success');
    } catch (error) {
        console.error("Login error:", error);
    }
}

    function logout() {
        signOut(auth).then(() => {
            user = "User";
            userStore.set(null);
            isLoggedIn = false;
        }).catch(error => console.error("Logout error:", error));
    }

    onAuthStateChanged(auth, (authUser) => {
        if (authUser) {
            user = authUser.displayName || "User";
            userStore.set(authUser);
            isLoggedIn = true;
        } else {
            user = "User";
            userStore.set(null);
            isLoggedIn = false;
        }
    });

    // Function to Add New Literature Entry
    function addLiterature() {
        if (title && author && isbn) {
            literatureList = [...literatureList, { title, author, isbn, comment }];
            title = author = isbn = comment = ""; // Reset fields
        } else {
            alert("Please fill in all required fields (Title, Author, ISBN).");
        }
    }

    async function addSampleData() {
        try {
            const docRef = await addDoc(collection(db, user), {
                title: title,
                author: author,
                year: isbn,
                description: comment
            });
            console.log("Document written with ID: ", docRef.id);

             // Clear the input fields after adding the document
            title = "";
            author = "";
            isbn = "";
            comment = "";
        } catch (error) {
            console.error("Error adding document: ", error);
        }
    }
    // Redirect to `/login` on initial load
    onMount(() => {
        navigate('/login');
    });
</script>


<Router>
    <div class="page-container">
        <Route path="/login" component={Login} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/library" component={Library} />
    <div class="container">
        {#if isLoggedIn}
            <div class="header">
                <div class="greeting">Welcome, {user}!</div>
                <div class="buttons">
                    <button on:click={logout}>Logout</button>
                </div>
            </div>

            <div class="main-content">
                <!-- Left: Literature Form -->
                <div class="form-section">
                    <h2>Add Scientific Literature</h2>
                    <input type="text" bind:value={title} placeholder="Title" />
                    <input type="text" bind:value={author} placeholder="Author" />
                    <input type="text" bind:value={isbn} placeholder="ISBN" />
                    <textarea bind:value={comment} placeholder="Comment"></textarea>
                    <button on:click={addSampleData}>Add Literature</button>

                    <div class="literature-list">
                        {#each literatureList as lit (lit.isbn)}
                            <div class="oval">
                                <strong>{lit.title}</strong> by {lit.author} <br />
                                <em>ISBN: {lit.isbn}</em> <br />
                                <p>{lit.comment}</p>
                            </div>
                        {/each}
                    </div>
                </div>

                <!-- Right: Graph Placeholders -->
                <div class="rectangle">
                    <h2>Your Reading Statistics</h2>
                    <div class="chart-placeholder">Graph 1 (Pie)</div>
                    <div class="chart-placeholder">Graph 2 (Bar)</div>
                    <div class="chart-placeholder">Streak Graph</div>
                </div>
            </div>
        {:else}
            <div class="welcome-message">
                <h1>Welcome to Track My Sci!</h1>
                <p>A place to track your scientific reading.</p>
                <button on:click={login}>Login with Google</button>
            </div>
        {/if}
    </div>
    
    <button on:click={addSampleData}>Add Sample Data</button>

    <Route path="/success" component={Success} />
</Router>