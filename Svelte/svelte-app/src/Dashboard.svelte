<script>
    import { userStore } from "./userStore";
    import { navigate } from "svelte-routing";
    import { Button } from "$lib/components/ui/button";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import { Separator } from "$lib/components/ui/separator";
    import { Progress } from "$lib/components/ui/progress";
    import * as Popover from "$lib/components/ui/popover";
    import * as Dialog from "$lib/components/ui/dialog";
    import { onAuthStateChanged } from "firebase/auth";
    import { auth, firestore } from "./firebase";
    import { signOut } from "firebase/auth";
    import { doc, getDoc, setDoc, collection, addDoc, query, where, getDocs, updateDoc } from "firebase/firestore";


    // Literature management variables
    let searchQuery = "";
    let title = "";
    let author = "";
    let isbn = "";
    let comment = "";
    let pageStart = 1;
    let pageEnd = 1;
    let currentPage = 1;
    let searchResults = [];
    let showResults = false;
    let tagInput = ""; // Input for new tag
    let tags = []; // Array of added tags
    let firstName = "Guest";
    let lastName = "";
    let errorMessage = "";

    // Loading state: indicates that we have determined the auth state and loaded initial data.
    let authReady = false;

    // Get user data from Firestore
    async function fetchUserData() {
        const user = auth.currentUser;
        if (!user) {
            console.error("No authenticated user found.");
            return;
        }
        try {
            const userDoc = await getDoc(doc(firestore, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                firstName = userData.firstName || "Guest";
                lastName = userData.lastName || "";
            } else {
                console.warn("User document not found in Firestore.");
            }
        } catch (error) {
        console.error("Error fetching user data:", error.message);
        }
    }

    // Load user's library from the "library" subcollection
    let libraryList = [];
    async function loadUserLibrary() {
        const user = auth.currentUser;
        if (!user) {
            console.error("No authenticated user found.");
            return;
        }
        try {
            const userDocRef = doc(firestore, "users", user.uid);
            const libraryRef = collection(userDocRef, "library");
            const q = query(libraryRef, where("userId", "==", user.uid));
            const querySnapshot = await getDocs(q);
            // Map each document to include its id.
            libraryList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching library:", error.message);
        }
    }

    async function updateProgress(entryId, newCurrentPage, pageStart) {
        const user = auth.currentUser;
        if (!user) {
            console.error("No authenticated user found.");
            return;
        }
        try {
            // Reference the specific library document using its id.
            const userDocRef = doc(firestore, "users", user.uid);
            const entryDocRef = doc(collection(userDocRef, "library"), entryId);
            const pagesRead = newCurrentPage - pageStart + 1; 
            await updateDoc(entryDocRef, {
                currentPage: newCurrentPage,
                updatedAt: new Date(),
                pagesRead: pagesRead
            });
            console.log(`Updated entry ${entryId} to page ${newCurrentPage}.`);
        } catch (error) {
            console.error("Error updating progress:", error.message);
        }
    }


    // Listen for auth state changes
    onAuthStateChanged(auth, async (user) => {
    console.log("Auth state changed. User:", user);
        if (user) {
            try {
                await fetchUserData();
                await loadUserLibrary();
            } catch (e) {
                console.error("Error during data fetching:", e);
            } finally {
                authReady = true;
                console.log("authReady set to true");
            }
        } else {
            console.warn("No user is currently authenticated.");
            // Instead of immediately redirecting, you might want to allow a short delay
            // or simply render the login page inside Dashboard.
            authReady = true;
            console.log("authReady set to true (no user)");
            navigate("/login");
        }
    });

    async function updateCharts() {
        const user = auth.currentUser;
        if (!user) {
            console.error("No authenticated user found.");
            return;
        }
        try {
            // Reference the user's document in the "users" collection.
            const userDocRef = doc(firestore, "users", user.uid);

            // Ensure the parent user document exists; if not, create it.
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists()) {
                await setDoc(userDocRef, { createdAt: new Date() });
            }

            // Reference the "charts" subcollection and define a fixed document ID "summary".
            const chartsDocRef = doc(collection(userDocRef, "charts"), "summary");
            // Now chartsDocRef is defined.

            // ---------------------------
            // Calculate "mostRecent"
            // ---------------------------
            let mostRecentEntry = null;
            for (const entry of libraryList) {
                let entryDate = null;
                if (entry.updatedAt) {
                    if (typeof entry.updatedAt.toDate === "function") {
                    entryDate = entry.updatedAt.toDate();
                    } else {
                    entryDate = new Date(entry.updatedAt);
                    }
                }
                if (!entryDate) continue;
                if (!mostRecentEntry || entryDate > mostRecentEntry.date) {
                    mostRecentEntry = { title: entry.title, date: entryDate };
                }
            }
            const mostRecent = mostRecentEntry ? mostRecentEntry.title : "None";

            // ---------------------------
            // Calculate "activity"
            // ---------------------------
            const now = new Date();
            let activity = { last30Days: 0, last90Days: 0, lastYear: 0 };
            for (const entry of libraryList) {
                let entryDate = null;
                if (entry.updatedAt) {
                    if (typeof entry.updatedAt.toDate === "function") {
                    entryDate = entry.updatedAt.toDate();
                    } else {
                    entryDate = new Date(entry.updatedAt);
                    }
                }
                if (!entryDate) continue;
                const diffDays = (now - entryDate) / (1000 * 60 * 60 * 24);
                const pagesRead = (entry.pagesRead !== undefined)
                    ? entry.pagesRead
                    : (entry.currentPage - entry.pageStart);
                if (diffDays <= 30) {
                    activity.last30Days += pagesRead;
                }
                if (diffDays <= 90) {
                    activity.last90Days += pagesRead;
                }
                if (diffDays <= 365) {
                    activity.lastYear += pagesRead;
                }
            }

            // ---------------------------
            // Calculate "tags"
            // ---------------------------
            let tagCounts = {};
            for (const entry of libraryList) {
                if (entry.tags && Array.isArray(entry.tags)) {
                    entry.tags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                    });
                }
            }

            // ---------------------------
            // Calculate "streak"
            // ---------------------------
            let updateDatesSet = new Set();
            for (const entry of libraryList) {
                let entryDate = null;
                if (entry.updatedAt) {
                    if (typeof entry.updatedAt.toDate === "function") {
                    entryDate = entry.updatedAt.toDate();
                    } else {
                    entryDate = new Date(entry.updatedAt);
                    }
                }
                if (!entryDate) continue;
                const dateStr = entryDate.toISOString().slice(0, 10);
                updateDatesSet.add(dateStr);
            }
            let updateDates = Array.from(updateDatesSet);
            updateDates.sort();
            let streak = 0;
            let currentDate = new Date();
            while (true) {
                const dateStr = currentDate.toISOString().slice(0, 10);
                if (updateDates.includes(dateStr)) {
                    streak++;
                    currentDate.setDate(currentDate.getDate() - 1);
                } else {
                    break;
                }
            }

            // ---------------------------
            // Assemble the charts data.
            // ---------------------------
            const chartsData = {
                mostRecent,  // Title of the most recently updated book.
                activity,    // Activity object with pages read sums.
                tags: tagCounts, // Aggregated tag counts.
                streak,      // Current consecutive update streak.
                updatedAt: new Date()
            };

            // Write (or update) the charts data to Firestore using setDoc with merge: true.
            await setDoc(chartsDocRef, chartsData, { merge: true });
            console.log("Charts updated:", chartsData);

        } catch (error) {
            console.error("Error updating charts:", error.message);
        }
    }
    
    // Add a tag
    function addTag() {
        if (tagInput.trim() && !tags.includes(tagInput.trim())) {
            tags = [...tags, tagInput.trim()];
            tagInput = ""; // Clear input after adding
        }
    }

    // Remove a tag
    function removeTag(index) {
        tags = tags.filter((_, i) => i !== index);
    }

    let open = false;

    let user;
    userStore.subscribe((value) => {
        user = value;
    });

    // Modal states
    let modalOpen = false;
    let trackingPageOpen = false;

    function openModal() {
        modalOpen = true;
    }

    function closeModal() {
        modalOpen = false;
        trackingPageOpen = false;
        resetFields(); // Clear modal fields on close
    }

    async function searchLiterature() {
        showResults = false;
        searchResults = [];
        isbn = "";

        if (/^10\.\d{4,9}\/[-._;()\/:A-Za-z0-9]+$/.test(searchQuery)) {
            // DOI
            await fetchDOI();
        } else if (/^(97(8|9))?\d{9}(\d|X)$/.test(searchQuery)) {
            // ISBN
            isbn = searchQuery;
            await fetchISBN();
        } else {
            // Title
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
                            ? fetchedData.author.map((a) => `${a.given} ${a.family}`).join(", ")
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
            const response = await fetch(
                `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
            );
            const data = await response.json();

            console.log("Raw API Response:", data); 

            if (data[`ISBN:${isbn}`]) {
                const bookData = data[`ISBN:${isbn}`];

                console.log("Book Data:", bookData); 

                searchResults = [
                    {
                        title: bookData.title || "Unknown Title",
                        author: bookData.authors
                            ? bookData.authors.map((a) => a.name).join(", ")
                            : "Unknown Author",
                        isbn: isbn,
                    },
                ];
            } else {
                console.warn("No ISBN data found in response.");
                searchResults = [];
            }
        } catch (error) {
            console.error("Error fetching ISBN data:", error);
            alert("Failed to retrieve ISBN information.");
        }
    }

    async function fetchTitle() {
        try {
            console.log("Fetching Title:", title);

            const response = await fetch(
                `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}`
            );
            const data = await response.json();

            console.log("Full API Response:", data);

            if (data.docs && data.docs.length > 0) {
                searchResults = await Promise.all(
                    data.docs.slice(0, 10).map(async (doc) => {
                        console.log("Processing book:", doc);

                        let isbn = doc.isbn ? doc.isbn[0] : null;

                        // If no ISBN, try fetching editions to get ISBN
                        if (!isbn && doc.key) {
                            isbn = await fetchISBNFromEditions(doc.key);
                        }

                        return {
                            title: doc.title || "Unknown Title",
                            author: doc.author_name ? doc.author_name.join(", ") : "Unknown Author",
                            isbn: isbn || "No ISBN",
                        };
                    })
                );

                console.log("Final Search Results:", searchResults);
            } else {
                console.warn("No title data found.");
                searchResults = [];
            }
        } catch (error) {
            console.error("Error fetching title data:", error);
            alert("Failed to retrieve title information.");
        }
    }

    // Fetch ISBN from Editions API if missing
    async function fetchISBNFromEditions(workKey) {
        try {
            console.log("Fetching ISBN from editions:", workKey);
            
            const response = await fetch(`https://openlibrary.org${workKey}/editions.json`);
            const data = await response.json();

            console.log("Editions Data:", data);

            // Extract ISBN from the first edition
            return data.entries?.[0]?.isbn_13?.[0] ||
                data.entries?.[0]?.isbn_10?.[0] ||
                null;
        } catch (error) {
            console.error("Error fetching ISBN from editions:", error);
            return null;
        }
    }

    function selectResult(result) {
        title = result.title;
        author = result.author;
        isbn = result.isbn;
        comment = "";
        pageStart = 1;
        pageEnd = 1;
        currentPage = 1;
        showResults = false;
    }

    function resetFields() {
        searchQuery = title = author = isbn = comment = "";
        pageStart = 1;
        pageEnd = 1;
        currentPage = 1;
        searchResults = [];
        showResults = false;
        tags = [];
        libraryList = []; // Clear the list so old entries are removed

    }


    async function saveEntryToFirestore(newEntry) {
        const user = auth.currentUser;
        if (!user) {
            console.error("No authenticated user found.");
            return;
        }

        try {
            // Reference the user's document in the "users" collection.
            const userDocRef = doc(firestore, "users", user.uid);

            // Ensure the parent user document exists; if not, create it.
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists()) {
                await setDoc(userDocRef, { createdAt: new Date() });
            }

            // Reference the "library" subcollection under the user's document.
            const libraryRef = collection(userDocRef, "library");

            // Query the subcollection for a document with the same ISBN as the new entry.
            console.log("Checking new entry ISBN:", newEntry.isbn);
            const isbnQuery = query(libraryRef, where("isbn", "==", newEntry.isbn));
            const querySnapshot = await getDocs(isbnQuery);
            console.log(`Query result for ISBN "${newEntry.isbn}" -> empty:`, querySnapshot.empty);

            if (!querySnapshot.empty) {
                // A duplicate was found—alert the user and do not save.
                alert("This article is already in your library!");
                resetFields();
                return;
            }

            // Compute pagesRead (you could add additional logic if needed)
            const pagesRead = newEntry.currentPage - newEntry.pageStart + 1;

            // If no duplicate exists, add the new entry with extra fields.
            await addDoc(libraryRef, {
                title: newEntry.title,
                author: newEntry.author,
                isbn: newEntry.isbn,
                pageStart: newEntry.pageStart,
                pageEnd: newEntry.pageEnd,
                currentPage: newEntry.currentPage,
                comment: newEntry.comment,
                tags: newEntry.tags,
                journalLogs: newEntry.journalLogs,
                userId: user.uid,
                createdAt: new Date(),
                updatedAt: new Date(),  // Added field for the last update timestamp
                pagesRead: pagesRead   // Added field for the number of pages read
            });
            console.log(`Added entry with ISBN ${newEntry.isbn}.`);

            // Update your libraryList (if needed)
            libraryList = [newEntry, ...libraryList];

            // Now clear the input fields and close the modal.
            resetFields();
            open = false;
            trackingPageOpen = true;
        } catch (error) {
            console.error("Error saving entry:", error.message);
        }
    }

    async function addLiteratureToLibrary() {
        if (title && author && isbn && pageStart && pageEnd && pageEnd >= pageStart) {
            const newEntry = {
                title,
                author,
                isbn,
                pageStart,
                pageEnd,
                currentPage: pageStart,
                comment,
                tags,
                journalLogs: [],
            };

            // Save the new entry (this function will perform the duplicate check).
            await saveEntryToFirestore(newEntry);
            await loadUserLibrary();
            await updateCharts();  // Update the charts after reloading the library.

        } else {
            alert("Please fill in all required fields before adding.");
        }
    }

    function logout() {
        const auth = getAuth();
        signOut(auth).then(() => {
            userStore.set(null);
            navigate("/login");
        });
    }
</script>

{#if !authReady}
    <!-- Show a loading indicator while waiting for auth state and data -->
    <div class="flex justify-center items-center h-screen">
        <p>Loading...</p>
    </div>
{:else}
    <!-- HTML Portion -->
    <div class="min-h-screen flex flex-col bg-white">
        <!-- Navbar -->
        <nav class="bg-white border-neutral-400 shadow h-16 flex items-center justify-between px-12 sticky top-0 z-50">
            <h1 class="text-lg font-semibold text-neutral-800">TrackMySci</h1>
            <div class="flex items-center space-x-6">
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                        <button class="border border-neutral-300 py-2 px-4 shadow-sm text-base font-medium rounded hover:bg-neutral-100 flex items-center gap-x-5">
                            {user?.displayName || "User"}
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-neutral-500">
                                <path fill-rule="evenodd" d="M11.47 4.72a.75.75 0 0 1 1.06 0l3.75 3.75a.75.75 0 0 1-1.06 1.06L12 6.31 8.78 9.53a.75.75 0 0 1-1.06-1.06l3.75-3.75Zm-3.75 9.75a.75.75 0 0 1 1.06 0L12 17.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-3.75 3.75a.75.75 0 0 1-1.06 0l-3.75-3.75a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content>
                        <DropdownMenu.Group>
                            <DropdownMenu.Item on:click={() => navigate("/dashboard")} class="text-base">Dashboard</DropdownMenu.Item>
                            <DropdownMenu.Item on:click={() => navigate("/library")} class="text-base">Library</DropdownMenu.Item>
                            <DropdownMenu.Separator />
                            <DropdownMenu.Item on:click={logout} class="text-red-500 text-base">Logout</DropdownMenu.Item>
                        </DropdownMenu.Group>
                    </DropdownMenu.Content>
                </DropdownMenu.Root>
            </div>
        </nav>

        <!-- Welcome Message -->
        <div class="pt-12 px-12">
            <h2 class="text-4xl font-bold text-neutral-800">Welcome, {firstName} 👋</h2>
        </div>

        <!-- Main Content -->
        <div class="flex flex-1">
            <section class="w-1/2 py-12 pl-12 pr-6">
                <h2 class="text-xl font-semibold mb-4 flex justify-between items-center text-neutral-700">
                    Recently Accessed
                    <Dialog.Root bind:open>
                        <Dialog.Trigger>
                            <Button class="bg-blue-600 hover:bg-blue-700">+ New publication</Button>
                        </Dialog.Trigger>
                        <Dialog.Content class="w-[90%] max-w-4xl">
                            <Dialog.Header>
                                <Dialog.Title class="text-xl mb-1">Add Literature</Dialog.Title>
                                <Dialog.Description>
                                    <form on:submit|preventDefault={addLiteratureToLibrary}>
                                        <!-- Search Bar -->
                                        <div class="mb-4">
                                            <div class="relative">
                                                <label for="searchQuery" class="sr-only">Search Query</label>
                                                <input type="text" id="searchQuery" bind:value={searchQuery}
                                                    on:keydown={(e) => {
                                                        if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            searchLiterature();
                                                        }
                                                    }}
                                                    class="w-full pl-4 pr-10 py-4 text-neutral-700 rounded-full border border-neutral-300 focus:ring-blue-500 focus:border-blue-500 shadow-sm placeholder-neutral-400"
                                                    placeholder="Search by DOI, ISBN, or Title" autocomplete="off" />
                                                <div class="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#9ca3af" class="w-6 h-6">
                                                        <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Search Results -->
                                        {#if showResults}
                                            <div class="absolute z-50 mt-2 space-y-2 max-h-80 overflow-y-auto border border-neutral-300 rounded p-2">
                                                {#each searchResults as result}
                                                    <button type="button" class="p-3 bg-neutral-100 rounded shadow cursor-pointer hover:bg-neutral-200 text-left w-full"
                                                        on:click={() => selectResult(result)}>
                                                        <strong>{result.title}</strong><br />
                                                        <small>Author: {result.author}</small><br />
                                                        <em>ISBN: {result.isbn}</em>
                                                    </button>
                                                {/each}
                                            </div>
                                        {/if}

                                        <!-- Form Fields -->
                                        <div class="flex flex-col gap-4 mt-4">
                                            <div class="flex flex-col">
                                                <label for="title" class="w-1/4 text-sm font-medium text-neutral-700">Title *</label>
                                                <input id="title" type="text" bind:value={title}
                                                    class="flex-1 p-1.5 pl-2 border border-neutral-300 shadow-sm rounded-md text-neutral-700" autocomplete="off" />
                                            </div>
                                            <div class="flex flex-col">
                                                <label for="author" class="w-1/4 text-sm font-medium text-neutral-700">Author *</label>
                                                <input id="author" type="text" bind:value={author}
                                                    class="flex-1 p-1.5 pl-2 border border-neutral-300 shadow-sm rounded-md text-neutral-700" autocomplete="off" />
                                            </div>
                                            <Separator />
                                            <div class="flex items-center">
                                                <label for="isbn-doi" class="w-1/4 text-sm font-medium text-neutral-700">ISBN/DOI *</label>
                                                <input id="isbn-doi" type="text" bind:value={isbn}
                                                    class="flex-1 p-1.5 pl-2 border rounded-md border-neutral-300 shadow-sm text-neutral-700" autocomplete="off" />
                                            </div>
                                            <Separator />
                                            <div class="flex gap-4 items-center">
                                                <div class="flex-1">
                                                    <label for="page-start" class="text-sm font-medium text-neutral-700">Page Start *</label>
                                                    <input id="page-start" type="number" bind:value={pageStart}
                                                        class="w-full p-1.5 pl-2 border rounded-md border-neutral-300 shadow-sm text-neutral-700" min="1" />
                                                </div>
                                                <div class="flex-1">
                                                    <label for="page-end" class="text-sm font-medium text-neutral-700">Page End *</label>
                                                    <input id="page-end" type="number" bind:value={pageEnd}
                                                        class="w-full p-1.5 pl-2 border rounded-md border-neutral-300 shadow-sm text-neutral-700" min={pageStart} />
                                                </div>
                                            </div>
                                            <Separator />
                                            <!-- Tag Input Section -->
                                            <div class="mb-4">
                                                <label for="tag-input" class="text-sm font-medium text-neutral-700">Tags</label>
                                                <div class="flex items-center mt-2">
                                                    <input id="tag-input" type="text" bind:value={tagInput}
                                                        class="flex-1 p-2 border rounded-md border-neutral-300 shadow-sm text-neutral-700"
                                                        placeholder="Type a tag and press Enter"
                                                        on:keydown={(e) => {
                                                            if (e.key === "Enter") {
                                                                e.preventDefault();
                                                                addTag();
                                                            }
                                                        }} />
                                                    <Button type="button" class="ml-2 bg-blue-500 hover:bg-blue-600" on:click={addTag}>Add Tag</Button>
                                                </div>
                                                <!-- Display Tags -->
                                                <div class="flex flex-wrap gap-2 mt-3">
                                                    {#each tags as tag, index}
                                                        <div class="flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                                                            <span>{tag}</span>
                                                            <button type="button" class="ml-2 text-blue-500 hover:text-blue-700" on:click={() => removeTag(index)}>
                                                                &times;
                                                            </button>
                                                        </div>
                                                    {/each}
                                                </div>
                                            </div>
                                            <Separator />
                                            <div class="flex items-center">
                                                <label for="comment" class="w-1/4 text-sm font-medium text-neutral-700">Comment</label>
                                                <textarea id="comment" bind:value={comment}
                                                    class="flex-1 p-1.5 pl-2 border rounded-md border-neutral-300 shadow-sm"></textarea>
                                            </div>
                                        </div>

                                        <!-- Footer Buttons -->
                                        <div class="flex justify-end space-x-4 mt-4">
                                            <Button type="button" on:click={resetFields} class="bg-neutral-200 text-neutral-700 hover:bg-neutral-300">Clear</Button>
                                            <Button type="submit" class="bg-blue-600 text-white hover:bg-blue-700">Add</Button>
                                        </div>
                                    </form>
                                </Dialog.Description>
                            </Dialog.Header>
                        </Dialog.Content>
                    </Dialog.Root>
                </h2>

                {#if libraryList.length === 0}
                    <!-- Message for empty list -->
                    <div class="flex flex-col items-center justify-center text-center text-gray-500 pt-12">
                        <p class="text-lg font-medium">No literature added yet.</p>
                        <p class="text-sm mt-2">Start by adding a new publication to track your progress!</p>
                    </div>
                {:else}
                    <ul class="space-y-3">
                        {#each libraryList as lit, index}
                            <li class="p-4 bg-white border border-neutral-300 rounded-md shadow">
                                <strong>{lit.title}</strong><br />
                                <small>{lit.author}</small><br />
                                <!-- Tags Section -->
                                {#if lit.tags?.length > 0}
                                    <div class="flex flex-wrap gap-2 mt-3">
                                        {#each lit.tags as tag}
                                            <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">{tag}</span>
                                        {/each}
                                    </div>
                                {/if}
                                <!-- Progress Section -->
                                <div class="mt-1 flex items-center gap-3">
                                    <!-- Progress Bar and Percentage -->
                                    <div class="flex-1">
                                        <div class="flex justify-between text-sm text-neutral-600 mb-1">
                                            <span>
                                                {Math.min(100, Math.round(((lit.currentPage || lit.pageStart) - lit.pageStart) / (lit.pageEnd - lit.pageStart) * 100))}%
                                            </span>
                                        </div>
                                        <Progress value={Math.min(100, Math.round(((lit.currentPage || lit.pageStart) - lit.pageStart) / (lit.pageEnd - lit.pageStart) * 100))} />
                                    </div>

                                    <!-- Popover for Updating Progress -->
                                    <Popover.Root>
                                        <Popover.Trigger>
                                          <!-- Use a button with some padding and background for visibility -->
                                          <Button class="p-2 bg-gray-700 text-white hover:bg-gray-800" aria-label="Update Progress">
                                            Update Progress
                                          </Button>
                                        </Popover.Trigger>
                                        <Popover.Content class="p-4 bg-white shadow-lg border rounded-md w-64">
                                          <div>
                                            <label for="current-page-{index}" class="text-sm font-medium text-neutral-700 mb-2 block">
                                              Current Page:
                                            </label>
                                            <input
                                              id="current-page-{index}"
                                              type="number"
                                              value={lit.currentPage}
                                              min={lit.pageStart}
                                              max={lit.pageEnd}
                                              on:change={(e) => {
                                                const newPage = Number(e.target.value);
                                                updateProgress(lit.id, newPage, lit.pageStart);
                                                // Update the local object so the UI reflects the change.
                                                lit.currentPage = newPage;
                                              }}
                                              class="w-full p-1 border rounded border-neutral-300 shadow-sm"
                                            />
                                          </div>
                                          <div class="flex justify-end space-x-2 mt-4"></div>
                                        </Popover.Content>
                                      </Popover.Root>
                                      
                                </div>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </section>
            <section class="w-1/2 py-12 pl-6 pr-12">
                <h2 class="text-xl font-semibold mb-4 text-neutral-700">Analytics</h2>
                <div class="space-y-6">
                    <!-- Placeholder Card 1 -->
                    <div class="bg-white border border-neutral-300 rounded-md shadow p-6">
                        <div class="h-40 rounded flex items-center justify-center">
                            <span class="text-neutral-400">Placeholder for Graph 1</span>
                        </div>
                    </div>
                    <!-- Placeholder Card 2 -->
                    <div class="bg-white border border-neutral-300 rounded-md shadow p-6">
                        <div class="h-40  rounded flex items-center justify-center">
                            <span class="text-neutral-400">Placeholder for Graph 2</span>
                        </div>
                    </div>
                    <!-- Placeholder Card 3 -->
                    <div class="bg-white border border-neutral-300 rounded-md shadow p-6">
                        <div class="h-40 rounded flex items-center justify-center">
                            <span class="text-neutral-400">Placeholder for Graph 3</span>
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
                    {#if !trackingPageOpen}
                        <form on:submit|preventDefault={addLiteratureToLibrary}>
                            <div class="mb-4">
                                <div class="relative">
                                    <input type="text" id="searchQuery" bind:value={searchQuery}
                                        on:keydown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                searchLiterature();
                                            }
                                        }}
                                        class="w-full pl-4 pr-10 py-2 rounded-full border border-neutral-300 focus:ring-blue-500 focus:border-blue-500 shadow-sm placeholder-neutral-400"
                                        placeholder="Search by DOI, ISBN, or Title" autocomplete="off" />
                                    <div class="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#9ca3af" class="size-6">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            {#if showResults}
                                <div class="mt-2 space-y-2 max-h-48 overflow-y-auto border border-neutral-300 rounded p-2">
                                    {#each searchResults as result}
                                        <button type="button" class="p-3 bg-neutral-100 rounded shadow cursor-pointer hover:bg-neutral-200 text-left w-full"
                                            on:click={() => selectResult(result)}>
                                            <strong>{result.title}</strong><br />
                                            <small>Author: {result.author}</small><br />
                                            <em>ISBN: {result.isbn}</em>
                                        </button>
                                    {/each}
                                </div>
                            {/if}

                            <div class="flex flex-col gap-4 mt-4">
                                <div class="flex items-center">
                                    <label for="title" class="w-1/4 text-sm font-medium text-neutral-700">Title*</label>
                                    <input id="title" type="text" bind:value={title} class="flex-1 p-1 border border-neutral-300 shadow-sm rounded" />
                                </div>
                                <div class="flex items-center">
                                    <label for="author" class="w-1/4 text-sm font-medium text-neutral-700">Author*</label>
                                    <input id="author" type="text" bind:value={author} class="flex-1 p-1 border rounded border-neutral-300 shadow-sm" />
                                </div>
                                <Separator></Separator>
                                <div class="flex items-center">
                                    <label for="isbn-doi" class="w-1/4 text-sm font-medium text-neutral-700">ISBN/DOI*</label>
                                    <input id="isbn-doi" type="text" bind:value={isbn} class="flex-1 p-1 border rounded border-neutral-300 shadow-sm" />
                                </div>
                                <Separator></Separator>
                                <div class="flex gap-4 items-center">
                                    <!-- Page Start -->
                                    <div class="flex-1">
                                        <label for="page-start" class="text-sm font-medium text-neutral-700">Page Start*</label>
                                        <input id="page-start" type="number" bind:value={pageStart} class="w-full p-1 border rounded border-neutral-300 shadow-sm" min="1" />
                                    </div>
                                    <!-- Page End -->
                                    <div class="flex-1">
                                        <label for="page-end" class="text-sm font-medium text-neutral-700">Page End*</label>
                                        <input id="page-end" type="number" bind:value={pageEnd} class="w-full p-1 border rounded border-neutral-300 shadow-sm" min={pageStart} />
                                    </div>
                                </div>
                                <Separator></Separator>
                                <div class="flex items-center">
                                    <label for="comment" class="w-1/4 text-sm font-medium text-neutral-700">Comment</label>
                                    <textarea id="comment" bind:value={comment} class="flex-1 p-1 border rounded border-neutral-300 shadow-sm"></textarea>
                                </div>
                            </div>

                            <div class="flex justify-end space-x-4 mt-4">
                                <Button type="button" on:click={resetFields} class="bg-neutral-300 text-neutral-700 hover:bg-neutral-400">Reset</Button>
                                <Button type="submit" class="bg-blue-600 text-white hover:bg-blue-700">Add</Button>
                                <Button type="button" on:click={closeModal} class="bg-neutral-300 text-neutral-700 hover:bg-neutral-400">Cancel</Button>
                            </div>
                        </form>
                    {/if}

                    {#if trackingPageOpen}
                        <div>
                            <h3 class="text-lg font-semibold mb-4">Track Your Reading Progress</h3>
                            <div class="flex items-center gap-4">
                                <label for="current-page" class="text-sm font-medium text-neutral-700">Current Page:</label>
                                <input id="current-page" type="number" bind:value={currentPage} class="p-1 border rounded border-neutral-300 shadow-sm" min={pageStart} max={pageEnd} />
                            </div>
                            <div class="flex justify-end space-x-4 mt-4">
                                <Button type="button" class="bg-blue-600 text-white hover:bg-blue-700"
                                    on:click={() => {
                                        // Update the current book's currentPage
                                        if (libraryList.length > 0) {
                                            libraryList[0].currentPage = currentPage; // Update the first book in the list
                                        }
                                        closeModal();
                                    }}>
                                    Save Progress
                                </Button>
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
{/if}