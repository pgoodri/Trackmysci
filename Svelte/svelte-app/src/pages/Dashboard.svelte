<script>
    import { getAuth, signOut } from 'firebase/auth';
    import { userStore } from '../userStore';
    import { navigate } from 'svelte-routing';
    import { onMount } from 'svelte';

    // Subscribe to user data
    let user;
    userStore.subscribe(value => {
        user = value;
    });

    // Literature management variables
    let title = "";
    let author = "";
    let isbn = "";
    let comment = "";
    let doi = "";
    let literatureList = JSON.parse(localStorage.getItem('literatureList') || "[]");

    // Add literature function
    function addLiterature() {
    if (title && author && isbn) {
            // Check for duplicates
            const isDuplicate = literatureList.some(lit => lit.isbn === isbn);

            if (isDuplicate) {
                alert("This literature entry already exists.");
            } else {
                const newEntry = { title, author, isbn, comment };
                literatureList = [...literatureList, newEntry];
                localStorage.setItem('literatureList', JSON.stringify(literatureList));

                title = author = isbn = comment = "";  // Reset fields
            }
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
                isbn = fetchedData.ISBN ? fetchedData.ISBN[0] : '';
                comment = '';
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

<div class="dashboard-container">
    <!-- Header Section with User Info and Navigation Buttons -->
    <header class="header">
        <span class="greeting">Welcome, {user?.displayName || "User"}!</span>
        <div class="nav-buttons">
            <button on:click={() => navigate('/library')}>Go to Library</button>
            <button on:click={logout}>Logout</button>
        </div>
    </header>

    <!-- Main Dashboard Content -->
    <main class="main-content">
        <!-- Literature Entry Form Section -->
        <section class="literature-form-section">
            <h2>Add Scientific Literature</h2>

            <input type="text" bind:value={doi} placeholder="Enter DOI" />
            <button on:click={fetchDOI}>Lookup DOI</button>

            <input type="text" bind:value={title} placeholder="Title" />
            <input type="text" bind:value={author} placeholder="Author" />
            <input type="text" bind:value={isbn} placeholder="ISBN" />
            <textarea bind:value={comment} placeholder="Comment"></textarea>
            <button on:click={addLiterature}>Add Literature</button>

            <!-- Display Added Literature List -->
            <div class="literature-list">
                {#each literatureList as lit (lit.isbn)}
                    <div class="literature-item">
                        <strong>{lit.title}</strong> by {lit.author} <br />
                        <em>ISBN: {lit.isbn}</em> <br />
                        <p>{lit.comment}</p>
                    </div>
                {/each}
            </div>
        </section>

        <!-- Statistics Placeholder Section -->
        <section class="statistics-section">
            <h2>Your Reading Statistics</h2>
            <div class="chart-placeholder">Graph 1 (Pie)</div>
            <div class="chart-placeholder">Graph 2 (Bar)</div>
            <div class="chart-placeholder">Streak Graph</div>
        </section>
    </main>
</div>

<style>
    /* Container and Layout Styles */
    .dashboard-container {
        display: flex;
        flex-direction: column;
        font-family: Arial, sans-serif;
        height: 100vh;
        background: linear-gradient(135deg, #ff7e5f, #feb47b);
        color: white;
        padding-top: 60px;
        align-items: center;
    }

    /* Header Styles */
    .header {
        position: fixed;
        top: 0;
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 20px;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        z-index: 10;
    }

    .greeting {
        font-size: 1.2rem;
    }

    .nav-buttons button {
        padding: 8px 12px;
        margin-left: 10px;
        border: none;
        border-radius: 5px;
        background-color: #007bff;
        color: white;
        cursor: pointer;
    }

    .nav-buttons button:hover {
        background-color: #0056b3;
    }

    /* Main Content Layout */
    .main-content {
        display: flex;
        width: 90%;
        max-width: 1200px;
        gap: 20px;
        padding: 20px;
        margin-top: 10px;
    }

    /* Literature Form Section */
    .literature-form-section {
        width: 60%;
        background-color: rgba(255, 255, 255, 0.9);
        border-radius: 8px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        color: black;
    }

    .literature-form-section input,
    .literature-form-section textarea {
        padding: 10px;
        border-radius: 4px;
        border: 1px solid #ddd;
        font-size: 16px;
    }

    .literature-form-section textarea {
        height: 80px;
        resize: none;
    }

    .literature-form-section button {
        align-self: flex-start;
        padding: 10px 15px;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
    }

    .literature-form-section button:hover {
        background-color: #0056b3;
    }

    /* Literature List Display */
    .literature-list {
        margin-top: 20px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .literature-item {
        background-color: #f0f0f0;
        padding: 10px;
        border-radius: 6px;
        color: black;
    }

    /* Statistics Section */
    .statistics-section {
        width: 40%;
        background-color: rgba(255, 255, 255, 0.9);
        border-radius: 8px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 15px;
        color: black;
    }

    .chart-placeholder {
        height: 150px;
        background-color: lightgray;
        border-radius: 8px;
        display: flex;
        justify-content: center;
        align-items: center;
        color: black;
    }
</style>
