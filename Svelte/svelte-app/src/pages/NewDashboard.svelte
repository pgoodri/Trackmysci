<script>
    import { getAuth, signOut } from 'firebase/auth';
    import { userStore } from '../userStore';
    import { navigate } from 'svelte-routing';
    import { Button } from "$lib/components/ui/button";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu"

    let user;
    userStore.subscribe(value => {
        user = value;
    });

    // Modal state
    let modalOpen = false;

    function openModal() {
        modalOpen = true;
    }

    function closeModal() {
        modalOpen = false;
        resetFields(); // Clear modal fields on close
    }

    // Literature management variables
    let searchQuery = "";
    let title = "";
    let author = "";
    let isbn = "";
    let pages = "";
    let comment = "";
    let searchResults = [];
    let showResults = false;

    // Load saved literature from localStorage
    let literatureList = JSON.parse(localStorage.getItem('literatureList') || "[]");

    function saveToLocalStorage() {
        localStorage.setItem('literatureList', JSON.stringify(literatureList));
    }

    async function searchLiterature() {
        // Reset fields before each search
        showResults = false;
        searchResults = [];
        isbn = ""; // Reset for each new search

        if (/^10\.\d{4,9}\/[-._;()\/:A-Za-z0-9]+$/.test(searchQuery)) {
            // If the query is a DOI
            await fetchDOI();
        } else if (/^(97(8|9))?\d{9}(\d|X)$/.test(searchQuery)) {
            // If the query is an ISBN
            isbn = searchQuery;
            await fetchISBN();
        } else {
            // If the query is neither DOI nor ISBN, treat it as a title
            title = searchQuery;
            await fetchTitle();
        }

        // Show results or alert if none found
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
                        pages: fetchedData.page || "N/A", // Add pages if available
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
                        pages: bookData.number_of_pages || "N/A", // Add pages if available
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
                    pages: doc.number_of_pages || "N/A", // Add pages if available
                }));
            } else {
                searchResults = [];
            }
        } catch (error) {
            console.error("Error fetching title data:", error);
            alert("Failed to retrieve title information.");
        }
    }


    function selectResult(result) {
        title = result.title;
        author = result.author;
        isbn = result.isbn;
        comment = '';
        showResults = false;
    }

    function resetFields() {
        searchQuery = title = author = isbn = comment = "";
        searchResults = [];
        showResults = false;
    }

    function addLiteratureToLibrary() {
        if (title && author && isbn) {
            const newEntry = { title, author, isbn, comment };

            // Add to literature list and save to localStorage
            literatureList = [newEntry, ...literatureList];
            saveToLocalStorage();

            closeModal();
        } else {
            alert("Please fill in all required fields before adding.");
        }
    }

    function logout() {
        const auth = getAuth();
        signOut(auth).then(() => {
            userStore.set(null);
            navigate('/login');
        });
    }
</script>

<div class="min-h-screen flex flex-col bg-white">
    <!-- Navbar -->
    <nav class="bg-white border-gray-400 shadow h-16 flex items-center justify-between px-12 sticky top-0 z-50">
        <h1 class="text-lg font-semibold text-gray-800">TrackMySci</h1>
        <div class="flex items-center space-x-6">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
                <button class="border border-gray-300 py-2 px-4 shadow-sm text-base font-medium rounded hover:bg-gray-100 flex items-center gap-x-5">
                    {user?.displayName || "User"}
                    <!-- Arrows SVG -->
                    <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    class="w-5 h-5 text-gray-500"
                    >
                    <path
                        fill-rule="evenodd"
                        d="M11.47 4.72a.75.75 0 0 1 1.06 0l3.75 3.75a.75.75 0 0 1-1.06 1.06L12 6.31 8.78 9.53a.75.75 0 0 1-1.06-1.06l3.75-3.75Zm-3.75 9.75a.75.75 0 0 1 1.06 0L12 17.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-3.75 3.75a.75.75 0 0 1-1.06 0l-3.75-3.75a.75.75 0 0 1 0-1.06Z"
                        clip-rule="evenodd"
                    />
                    </svg>
                  </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Group>
                <DropdownMenu.Item on:click={() => navigate('/library')}>Library</DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item on:click={logout} class = 'text-red-500'>Logout</DropdownMenu.Item>
              </DropdownMenu.Group>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      </nav>

    <!-- Welcome Message -->
    <div class="pt-12 px-12">
        <h2 class=" text-4xl font-bold text-gray-800">
            Welcome, {user?.displayName?.split(" ")[0] || "Guest"}!
        </h2>
    </div>

    <!-- Main Content -->
    <div class="flex flex-1">
        <!-- Recently Accessed Section -->
        <section class="w-1/2 p-12 ">
            <h2 class="text-xl font-semibold mb-4 flex justify-between items-center">
                Recently Accessed
                <Button class="bg-blue-600 text-white hover:bg-blue-700" on:click={openModal}>
                    + New
                </Button>
            </h2>
            <ul class="space-y-3">
                {#each literatureList as lit}
                <li class="p-4 bg-white border border-gray-300 rounded-md shadow">
                    <strong>{lit.title}</strong><br />
                    <small>Author: {lit.author}</small><br />
                    <small>ISBN/DOI: {lit.isbn || "N/A"}</small><br />
                    <p>{lit.comment}</p>
                </li>
                {/each}
            </ul>            
        </section>
    
        <!-- Graph Placeholders Section -->
        <section class="w-1/2 p-12">
            <h2 class="text-xl font-semibold mb-4">Analytics</h2>
            <div class="space-y-6">
                <!-- Placeholder Card 1 -->
                <div class="bg-white border border-gray-300 rounded-md shadow p-6">
                    <div class="h-32 bg-gray-100 rounded flex items-center justify-center">
                        <span class="text-gray-400">Placeholder for Graph 1</span>
                    </div>
                </div>
                <!-- Placeholder Card 2 -->
                <div class="bg-white border border-gray-300 rounded-md shadow p-6">
                    <div class="h-32 bg-gray-100 rounded flex items-center justify-center">
                        <span class="text-gray-400">Placeholder for Graph 2</span>
                    </div>
                </div>
                <!-- Placeholder Card 3 -->
                <div class="bg-white border border-gray-300 rounded-md shadow p-6">
                    <div class="h-32 bg-gray-100 rounded flex items-center justify-center">
                        <span class="text-gray-400">Placeholder for Graph 3</span>
                    </div>
                </div>
            </div>
        </section>
    </div>
    
    <!-- Modal -->
    {#if modalOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div class="bg-white rounded-lg shadow p-8 w-2/3 max-h-[90vh] overflow-y-auto">
            <h3 class="text-lg font-semibold mb-4">Add New Literature</h3>
            <form on:submit|preventDefault={addLiteratureToLibrary}>
                <!-- Search Bar -->
                <div class="mb-4">
                    <div class="relative">
                        <!-- Input Field -->
                        <input
                            type="text"
                            id="searchQuery"
                            bind:value={searchQuery}
                            on:keydown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    searchLiterature();
                                }
                            }}
                            class="w-full pl-4 pr-10 py-2 rounded-full border border-gray-300 focus:ring-blue-500 focus:border-blue-500 shadow-sm placeholder-gray-400"
                            placeholder="Search by DOI, ISBN, or Title"
                            autocomplete="off"
                        />
                        <!-- Search Icon -->
                        <div class="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#9ca3af" class="size-6">
                                <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                              </svg>
                        </div>
                    </div>
                </div>
                
    
                <!-- Search Results -->
                {#if showResults}
                <div class="mt-2 space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded p-2">
                    {#each searchResults as result}
                    <button
                        type="button"
                        class="p-3 bg-gray-100 rounded shadow cursor-pointer hover:bg-gray-200 text-left w-full"
                        on:click={() => selectResult(result)}
                    >
                        <strong>{result.title}</strong><br />
                        <small>Author: {result.author}</small><br />
                        <em>ISBN: {result.isbn}</em>
                    </button>
                    {/each}
                </div>
                {/if}
    
                <!-- Form Inputs -->
                <div class="flex flex-col gap-4 mt-4">
                    <!-- Title -->
                    <div class="flex items-center">
                        <label for="title" class="w-1/4 text-sm font-medium text-gray-700">Title*</label>
                        <input
                            id="title"
                            type="text"
                            bind:value={title}
                            class="flex-1 p-1 border border-gray-300 shadow-sm rounded "
                            readonly
                        />
                    </div>

                    <!-- Author -->
                    <div class="flex items-center">
                        <label for="author" class="w-1/4 text-sm font-medium text-gray-700">Author*</label>
                        <input
                            id="author"
                            type="text"
                            bind:value={author}
                            class="flex-1 p-1 border rounded  border-gray-300 shadow-sm"
                            readonly
                        />
                    </div>

                    
                    <!-- ISBN/DOI -->
                    <div class="flex items-center">
                        <label for="isbn-doi" class="w-1/4 text-sm font-medium text-gray-700">ISBN/DOI*</label>
                        <input
                            id="isbn-doi"
                            type="text"
                            bind:value={isbn}
                            class="flex-1 p-1 border rounded border-gray-300 shadow-sm"
                            readonly
                        />
                    </div>


                    <!-- Comment -->
                    <div class="flex items-center">
                        <label for="comment" class="w-1/4 text-sm font-medium text-gray-700">Comment</label>
                        <textarea
                            id="comment"
                            bind:value={comment}
                            class="flex-1 p-1 border rounded  border-gray-300 shadow-sm"
                        ></textarea>
                    </div>
                </div>

    
                <!-- Form Actions -->
                <div class="flex justify-end space-x-4 mt-4">
                    <Button type="button" on:click={resetFields} class="bg-gray-300 text-gray-700 hover:bg-gray-400">
                        Reset
                    </Button>
                    <Button type="submit" class="bg-blue-600 text-white hover:bg-blue-700">
                        Add
                    </Button>
                    <Button type="button" on:click={closeModal} class="bg-gray-300 text-gray-700 hover:bg-gray-400">
                        Cancel
                    </Button>
                </div>
            </form>
        </div>
    </div>
    
    {/if}
</div>
