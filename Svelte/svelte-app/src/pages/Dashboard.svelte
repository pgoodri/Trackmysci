<script>
    import { getAuth, signOut } from 'firebase/auth';
    import { userStore } from '../userStore';
    import { navigate } from 'svelte-routing';
    import { onMount } from 'svelte';

    // Subscribe to the userStore to get the logged-in user's details
    let user;
    userStore.subscribe(value => {
        user = value;
    });

    // Variables for literature management
    let title = "";
    let author = "";
    let isbn = "";
    let comment = "";
    let doi = ""; // DOI variable
    let literatureList = [];

    // Function to add new literature entry
    function addLiterature() {
        if (title && author && isbn) {
            literatureList = [...literatureList, { title, author, isbn, comment }];
            title = author = isbn = comment = "";  // Reset fields
        } else {
            alert("Please fill in all required fields (Title, Author, ISBN).");
        }
    }

    // DOI Lookup Function
    async function fetchDOI() {
        try {
            const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
            const data = await response.json();
            if (data.status === 'ok') {
                const fetchedData = data.message;
                title = fetchedData.title[0] || '';
                author = fetchedData.author.map(a => `${a.given} ${a.family}`).join(', ');
                isbn = fetchedData.ISBN ? fetchedData.ISBN[0] : ''; // Not all DOIs have ISBNs
                comment = ''; // Clear comment if needed
            } else {
                alert("No article found for this DOI.");
            }
        } catch (error) {
            console.error("Error fetching DOI data:", error);
            alert("Failed to retrieve DOI information.");
        }
    }

    // Logout function
    function logout() {
        const auth = getAuth();
        signOut(auth).then(() => {
            userStore.set(null);
            navigate('/login');
        });
    }
</script>

<div class="container">
    <div class="header">
        <div class="greeting">
            Welcome, {user?.displayName || "User"}!
        </div>
        <div class="buttons">
            <button on:click={logout}>Logout</button>
        </div>
    </div>

    <div class="main-content">
        <!-- Left: Literature Form -->
        <div class="form-section">
            <h2>Add Scientific Literature</h2>

            <!-- DOI Lookup -->
            <input type="text" bind:value={doi} placeholder="Enter DOI" />
            <button on:click={fetchDOI}>Lookup DOI</button> <!-- New DOI Lookup Button -->

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
    .container {
        display: flex;
        flex-direction: column;
        padding: 20px;
        font-family: Arial, sans-serif;
        height: 100vh;
        justify-content: center;
        align-items: center;
        background: linear-gradient(135deg, #ff7e5f, #feb47b);
        color: white;
    }

    .header {
        position: absolute;
        top: 20px;
        width: 100%;
        display: flex;
        justify-content: space-between;
    }

    .greeting {
        font-size: 24px;
        margin-left: 20px;
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
