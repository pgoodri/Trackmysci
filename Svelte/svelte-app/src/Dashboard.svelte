<script>
    import { navigate } from 'svelte-routing';
    import { userStore } from './userStore';
    import { getAuth, signOut } from 'firebase/auth';
    import { onMount } from 'svelte';

    let user = "User";
    let isLoggedIn = false;
    let title = "";
    let author = "";
    let isbn = "";
    let comment = "";
    let literatureList = [];

    const auth = getAuth();

    // Check if the user is logged in and update the greeting
    onMount(() => {
        const savedLiteratureList = localStorage.getItem('literatureList');
        if (savedLiteratureList) {
            literatureList = JSON.parse(savedLiteratureList);
        }
        
        userStore.subscribe(value => {
            if (value) {
                user = value.displayName || "User";
                isLoggedIn = true;
            } else {
                user = "User";
                isLoggedIn = false;
            }
        });
    });

    // Function to log the user out
    function logout() {
        signOut(auth).then(() => {
            user = "User";
            userStore.set(null);
            isLoggedIn = false;
            navigate('/');
        }).catch(error => console.error("Logout error:", error));
    }

    function addLiterature() {
        if (title && author && isbn) {
            literatureList = [...literatureList, { title, author, isbn, comment }];
            localStorage.setItem('literatureList', JSON.stringify(literatureList));
            title = author = isbn = comment = ""; // Reset fields
            navigate('/library'); // Navigate to Library page
        } else {
            alert("Please fill in all required fields (Title, Author, ISBN).");
        }
    }
</script>

<div class="container">
    <!-- Header Section -->
    {#if isLoggedIn}
        <div class="header">
            <div class="greeting">Welcome, {user}!</div>
            <div class="buttons">
                <button on:click={logout}>Logout</button>
            </div>
        </div>
    {/if}

    <div class="main-content">
        <!-- Left: Literature Form -->
        <div class="form-section">
            <h2>Add Scientific Literature</h2>
            <input type="text" bind:value={title} placeholder="Title" />
            <input type="text" bind:value={author} placeholder="Author" />
            <input type="text" bind:value={isbn} placeholder="ISBN" />
            <textarea bind:value={comment} placeholder="Comment"></textarea>
            <button on:click={addLiterature}>Add Literature</button>

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
</div>

<style>
    /* Full-page background gradient */
    .container {
        margin: 0;
        display: flex;
        flex-direction: column;
        padding: 20px;
        font-family: Arial, sans-serif;
        height: 100vh;
        background: linear-gradient(135deg, #ff7e5f, #feb47b);
        color: white;
        align-items: center;
    }

    /* Header styling */
    .header {
        position: absolute;
        top: 20px;
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .greeting {
        font-size: 24px;
        margin-left: 20px;
        color: white;
    }

    .buttons button {
        padding: 10px 20px;
        background-color: #007bff;
        border: none;
        border-radius: 5px;
        color: white;
        cursor: pointer;
        margin-right: 20px;
    }

    .buttons button:hover {
        background-color: #0056b3;
    }

    .main-content {
        display: flex;
        width: 100%;
        gap: 20px;
        margin-top: 100px;
    }

    .form-section {
        width: 50%;
        background-color: rgba(255, 255, 255, 0.8);
        border-radius: 10px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        color: black;
    }

    input, textarea {
        width: 100%;
        padding: 10px;
        margin-bottom: 10px;
        border-radius: 5px;
        border: 1px solid #ddd;
    }

    textarea {
        height: 80px;
        resize: none;
    }

    .literature-list {
        margin-top: 20px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .oval {
        background-color: lightgray;
        border-radius: 20px;
        padding: 10px;
        text-align: center;
    }

    .rectangle {
        width: 50%;
        background-color: rgba(255, 255, 255, 0.8);
        border-radius: 20px;
        padding: 20px;
    }

    .rectangle h2 {
        color: black;
    }

    .chart-placeholder {
        height: 150px;
        background-color: lightgray;
        border-radius: 10px;
        display: flex;
        justify-content: center;
        align-items: center;
        color: black;
    }
</style>