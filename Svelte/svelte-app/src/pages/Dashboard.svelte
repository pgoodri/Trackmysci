<script>
    import { getAuth, signOut } from 'firebase/auth';
    import { userStore } from '../userStore';
    import { navigate } from 'svelte-routing';

    let user = $state();
    userStore.subscribe(value => {
        user = value;
    });

    // Literature management variables
    let searchQuery = $state("");
    let title = $state("");
    let author = $state("");
    let isbn = $state("");
    let comment = $state("");
    let literatureList = $state(JSON.parse(localStorage.getItem('literatureList') || "[]"));
    let searchResults = $state([]);  // Holds search suggestions
    let showResults = $state(false); // Toggles the display of suggestions

    // Add literature function
    function addLiterature() {
        if (title && author && isbn) {
            const isDuplicate = literatureList.some(lit => lit.isbn === isbn);

            if (isDuplicate) {
                alert("This literature entry already exists.");
            } else {
                const newEntry = { title, author, isbn, comment };
                literatureList = [...literatureList, newEntry];
                localStorage.setItem('literatureList', JSON.stringify(literatureList));

                resetFields();
            }
        } else {
            alert("Please fill in all required fields (Title, Author, ISBN).");
        }
    }

    function resetFields() {
        title = author = isbn = comment = "";
        searchResults = [];
        showResults = false;
    }

    // Unified Search Function with Suggested Search
    async function searchLiterature() {
        showResults = false;
        searchResults = [];

        if (/^10\.\d{4,9}\/[-._;()\/:A-Za-z0-9]+$/.test(searchQuery)) {
            await fetchDOI();
        } else if (/^(97(8|9))?\d{9}(\d|X)$/.test(searchQuery)) {
            isbn = searchQuery;
            await fetchISBN();
        } else {
            title = searchQuery;
            await fetchTitle();
        }

        if (searchResults.length > 0) {
            showResults = true;
        } else {
            alert("No results found.");
        }
    }

    async function fetchDOI() {
        try {
            const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(searchQuery)}`);
            const data = await response.json();

            if (data.status === "ok") {
                const fetchedData = data.message;
                searchResults = [
                    {
                        title: fetchedData.title ? fetchedData.title[0] : "Unknown Title",
                        author: fetchedData.author
                            ? fetchedData.author.map(a => `${a.given} ${a.family}`).join(", ")
                            : "Unknown Author",
                        isbn: fetchedData.ISBN ? fetchedData.ISBN[0] : "No ISBN",
                    },
                ];
            } else {
                searchResults = [];
            }
        } catch (error) {
            console.error("Error fetching DOI data:", error);
            alert("Failed to retrieve DOI information.");
        }
    }

    async function fetchISBN() {
        try {
            const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
            const data = await response.json();

            if (data[`ISBN:${isbn}`]) {
                const bookData = data[`ISBN:${isbn}`];
                searchResults = [
                    {
                        title: bookData.title || "Unknown Title",
                        author: bookData.authors ? bookData.authors.map(a => a.name).join(", ") : "Unknown Author",
                        isbn: isbn,
                    },
                ];
            } else {
                searchResults = [];
            }
        } catch (error) {
            console.error("Error fetching ISBN data:", error);
            alert("Failed to retrieve ISBN information.");
        }
    }

    async function fetchTitle() {
        try {
            const response = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}`);
            const data = await response.json();

            if (data.docs && data.docs.length > 0) {
                searchResults = data.docs.slice(0, 10).map(doc => ({
                    title: doc.title || "Unknown Title",
                    author: doc.author_name ? doc.author_name.join(", ") : "Unknown Author",
                    isbn: doc.isbn ? doc.isbn[0] : "No ISBN",
                }));
            } else {
                searchResults = [];
            }
        } catch (error) {
            console.error("Error fetching title data:", error);
            alert("Failed to retrieve title information.");
        }
    }

    // Function to handle selection of a search result
    function selectResult(result) {
        title = result.title;
        author = result.author;
        isbn = result.isbn;
        comment = '';  // Reset comment field
        showResults = false;  // Hide suggestions after selection
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
    <header class="header">
        <span class="greeting">Welcome, {user?.displayName || "User"}!</span>
        <div class="nav-buttons">
            <button onclick={() => navigate('/library')}>Go to Library</button>
            <button onclick={logout}>Logout</button>
        </div>
    </header>

    <main class="main-content">
        <section class="literature-form-section">
            <h2>Add Scientific Literature</h2>

            <input type="text" bind:value={searchQuery} placeholder="Enter DOI, ISBN, or Title" />
            <button onclick={searchLiterature}>Search</button>

            {#if showResults}
                <div class="search-results">
                    {#each searchResults as result}
                        <div 
                            class="result-item" 
                            tabindex="0"
                            role="button"
                            onclick={() => selectResult(result)}
                            onkeydown={(event) => (event.key === 'Enter' || event.key === ' ') && selectResult(result)}
                        >
                            <strong>{result.title}</strong><br />
                            <small>by {result.author}</small><br />
                            <em>ISBN: {result.isbn}</em>
                        </div>
                    {/each}
                </div>
            {/if}

            <input type="text" bind:value={title} placeholder="Title" readonly />
            <input type="text" bind:value={author} placeholder="Author" readonly />
            <input type="text" bind:value={isbn} placeholder="ISBN" readonly />
            <textarea bind:value={comment} placeholder="Comment"></textarea>
            <button onclick={addLiterature}>Add Literature</button>
            <button onclick={resetFields}>Clear</button>

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

        <!-- Statistics Placeholder Section with Graphs -->
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

    /* Search Results Styles */
    .search-results {
        background-color: white;
        border: 1px solid #ccc;
        max-height: 200px;
        overflow-y: auto;
        width: 100%;
        margin-top: 10px;
        padding: 10px;
        border-radius: 5px;
    }
    
    .result-item {
        padding: 5px;
        cursor: pointer;
        border-bottom: 1px solid #ddd;
    }

    .result-item:hover {
        background-color: #f0f0f0;
    }
</style>
