<script>
    import { auth, firestore } from "./firebase";
    import { doc, collection, getDocs, getDoc, addDoc, updateDoc, setDoc, query, where } from "firebase/firestore";
    import { onAuthStateChanged, signOut } from "firebase/auth";
    import { onMount } from "svelte";
    import { writable, get } from "svelte/store";
    import { 
        Plus, 
        BookOpen, 
        Edit, 
        Trash2, 
        Ellipsis, 
        Book, 
        Filter,
        Search 
    } from "lucide-svelte";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import * as Dialog from "$lib/components/ui/dialog";
    import * as Popover from "$lib/components/ui/popover";
    import { Button } from "$lib/components/ui/button";

    // State
    let isLoading = true;
    let firstName = "User";
    let lastName = "";
    
    // Initialize writable stores
    const books = writable([]);
    const selectedTags = writable([]);
    const uniqueTags = writable([]);
    
    // Search and filter
    let searchLibraryQuery = ""; // Renamed to avoid conflict with form searchQuery
    let activeFilter = "all"; // Options: all, unread, reading, completed
    
    // We'll use the actual tags from the publications instead of hardcoded ones
    // Just need an "All" option
    const allTagsOption = "All";
    
    // Modal states
    let viewModalOpen = false;
    let viewingPublication = null;
    let logReadingModalOpen = false;
    let modalOpen = false; // For add/edit publication modal (named the same as in Dashboard)
    let editMode = false;
    let editingPublication = null;
    let isSearching = false;
    
    // Publication form fields
    let searchQuery = "";
    let title = "";
    let author = "";
    let isbn = "";
    let tagInput = "";
    let tags = [];
    let comment = "";
    let searchResults = [];
    let showResults = false;
    
    // Load user data
    async function fetchUserData(uid) {
        try {
            const userDoc = await getDoc(doc(firestore, "users", uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                firstName = userData.firstName || "User";
                lastName = userData.lastName || "";
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    }
    
    // Load books
    async function loadUserLibrary(uid) {
        try {
            const userDocRef = doc(firestore, "users", uid);
            const libraryRef = collection(userDocRef, "library");
            const querySnapshot = await getDocs(libraryRef);
            
            const loadedBooks = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Update store
            books.set(loadedBooks);
            
            // Extract tags
            const allTags = new Set();
            loadedBooks.forEach(book => {
                if (book.tags && Array.isArray(book.tags)) {
                    book.tags.forEach(tag => allTags.add(tag));
                }
            });
            uniqueTags.set([...allTags]);
        } catch (error) {
            console.error("Error loading books:", error);
            books.set([]);
        }
    }
    
    // Filter books
    function getFilteredBooks() {
        const allBooks = get(books);
        const tags = get(selectedTags);
        
        return allBooks.filter(book => {
            // Filter by search
            const matchesSearch = !searchLibraryQuery || 
                book.title?.toLowerCase().includes(searchLibraryQuery.toLowerCase()) ||
                book.author?.toLowerCase().includes(searchLibraryQuery.toLowerCase());
                
            // Filter by tags
            const matchesTags = tags.length === 0 || 
                (book.tags && book.tags.some(tag => tags.includes(tag)));
            
            // Filter by status
            let matchesStatus = true;
            if (activeFilter !== "all") {
                if (activeFilter === "completed") {
                    matchesStatus = book.completed === true || book.status === "completed";
                } else if (activeFilter === "reading") {
                    matchesStatus = !book.completed && (book.status === "in progress" || 
                                   (book.readingSessions && book.readingSessions.length > 0));
                } else if (activeFilter === "unread") {
                    matchesStatus = !book.completed && 
                                   (!book.readingSessions || book.readingSessions.length === 0) &&
                                   (book.status === "unread" || !book.status);
                }
            }
                
            return matchesSearch && matchesTags && matchesStatus;
        });
    }
    
    // Set active filter by status
    function setStatusFilter(status) {
        activeFilter = status;
    }
    
    // Filter by tag
    function setTagFilter(tag) {
        if (tag === "All") {
            selectedTags.set([]);
        } else {
            selectedTags.set([tag]);
        }
    }
    
    // Toggle a tag filter
    function toggleTag(tag) {
        selectedTags.update(tags => {
            if (tags.includes(tag)) {
                return tags.filter(t => t !== tag);
            } else {
                return [...tags, tag];
            }
        });
    }
    
    // Modal functions
    function openViewModal(book) {
        viewingPublication = book;
        viewModalOpen = true;
    }
    
    function openLogReadingModal() {
        logReadingModalOpen = true;
    }
    
    function logout() {
        signOut(auth).then(() => {
            window.location.href = "/login";
        });
    }
    
    function showAddPublicationForm() {
        // Reset form fields
        editMode = false;
        editingPublication = null;
        resetFields();
        modalOpen = true;
    }
    
    function resetFields() {
        searchQuery = title = author = isbn = comment = "";
        searchResults = [];
        showResults = false;
        tagInput = "";
        tags = [];
    }
    
    function addTag() {
        if (tagInput && !tags.includes(tagInput)) {
            tags = [...tags, tagInput];
            tagInput = "";
        }
    }
    
    function removeTag(index) {
        tags = tags.filter((_, i) => i !== index);
    }
    
    // Search literature in external APIs
    async function searchLiterature() {
        // Reset previous results
        showResults = false;
        searchResults = [];
        isSearching = true;
        
        // Simplified placeholder just for visual matching with Dashboard
        try {
            // Just simulate a search
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Provide a dummy result for demonstration
            if (searchQuery.trim()) {
                searchResults = [{
                    title: `Sample: ${searchQuery}`,
                    author: "Sample Author",
                    isbn: "1234567890123"
                }];
                showResults = true;
            }
        } catch (error) {
            console.error("Error searching:", error);
            alert("Search feature not implemented in this version.");
        } finally {
            isSearching = false;
        }
    }
    
    // Select a result from search
    function selectResult(result) {
        if (!result) return;
        
        // Fill in the form fields with the selected result
        title = result.title || "";
        author = result.author || "";
        isbn = result.isbn || result.doi || "";
        
        // Hide the results
        showResults = false;
    }
    
    // Close modal
    function closeModal() {
        modalOpen = false;
        editMode = false;
        editingPublication = null;
        resetFields();
    }
    
    // Add literature to library - matches Dashboard's function
    async function addLiteratureToLibrary() {
        if (title && author) { // Only require title and author
            const newEntry = {
                title,
                author,
                isbn: isbn || "", // Make ISBN/DOI optional
                comment,
                tags: Array.isArray(tags) ? tags.map(tag => tag.trim()) : [],
                readingSessions: [],
                status: "unread",
                completed: false,
                totalPagesRead: 0
            };
            
            await saveEntryToFirestore(newEntry);
            await loadUserLibrary(auth.currentUser.uid);
            
            // Update tags list
            const allTags = new Set(get(uniqueTags));
            tags.forEach(tag => allTags.add(tag));
            uniqueTags.set([...allTags]);
        } else {
            alert("Please fill in all required fields before adding.");
        }
    }
    
    // Save entry to Firestore - matches Dashboard's function
    async function saveEntryToFirestore(newEntry) {
        const user = auth.currentUser;
        if (!user) {
            console.error("No authenticated user found.");
            return;
        }
        
        try {
            const userDocRef = doc(firestore, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists()) {
                await setDoc(userDocRef, { createdAt: new Date() });
            }
            
            const libraryRef = collection(userDocRef, "library");
            
            // Check if same title and author already exists
            const titleQuery = query(libraryRef, where("title", "==", newEntry.title), where("author", "==", newEntry.author));
            const titleQuerySnapshot = await getDocs(titleQuery);
            if (!titleQuerySnapshot.empty) {
                alert("This publication is already in your library!");
                resetFields();
                return;
            }
            
            // Check ISBN if provided
            if (newEntry.isbn) {
                const isbnQuery = query(libraryRef, where("isbn", "==", newEntry.isbn));
                const isbnQuerySnapshot = await getDocs(isbnQuery);
                if (!isbnQuerySnapshot.empty) {
                    alert("This ISBN is already in your library!");
                    resetFields();
                    return;
                }
            }
            
            // Add document
            await addDoc(libraryRef, {
                title: newEntry.title,
                author: newEntry.author,
                isbn: newEntry.isbn,
                comment: newEntry.comment,
                tags: newEntry.tags,
                readingSessions: newEntry.readingSessions || [],
                status: newEntry.status || "unread",
                completed: newEntry.completed || false,
                totalPagesRead: newEntry.totalPagesRead || 0,
                userId: user.uid,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            // Update local data
            books.update(currentBooks => [newEntry, ...currentBooks]);
            resetFields();
            modalOpen = false;
            
            alert("Publication added successfully!");
        } catch (error) {
            console.error("Error saving entry:", error);
            alert("Failed to add publication. Please try again.");
        }
    }
    
    function deletePublication() {
        alert("Delete publication not implemented in this version");
    }
    
    // Initialize with proper auth state handling
    onMount(() => {
        isLoading = true;
        
        // Use Firebase's auth state listener instead of checking currentUser directly
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            console.log("Auth state changed. User:", user);
            
            try {
                if (user) {
                    console.log("User authenticated:", user.uid);
                    await Promise.all([
                        fetchUserData(user.uid),
                        loadUserLibrary(user.uid)
                    ]);
                } else {
                    console.log("No authenticated user, redirecting to login");
                    window.location.href = "/login";
                }
            } catch (error) {
                console.error("Error during initialization:", error);
            } finally {
                isLoading = false;
            }
        });
        
        // Return cleanup function to unsubscribe from auth state changes
        return () => unsubscribe();
    });
</script>

{#if isLoading}
    <div class="flex justify-center items-center h-screen bg-gray-50">
        <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
    </div>
{:else}
    <div class="min-h-screen flex flex-col bg-gray-50">
        <!-- Top Navigation Bar -->
        <nav class="bg-white border-b border-gray-200 shadow-sm h-16 flex items-center justify-between px-6 md:px-12 sticky top-0 z-50">
            <div class="flex items-center gap-8">
                <h1 class="text-xl font-bold text-blue-600">TrackMySci</h1>
                
                <div class="hidden md:flex items-center space-x-6">
                    <button class="text-gray-600 hover:text-blue-600" on:click={() => window.location.href='/dashboard'}>Dashboard</button>
                    <button class="text-gray-800 font-medium hover:text-blue-600">Library</button>
                </div>
            </div>
            
            <div class="flex items-center gap-3">
                <button class="text-gray-600 hover:text-blue-600 flex items-center px-3 py-2" on:click={openLogReadingModal}>
                    <BookOpen class="w-4 h-4 mr-1" /> Log Session
                </button>
                
                <Button class="bg-blue-600 hover:bg-blue-700" on:click={showAddPublicationForm}>
                    <Plus class="w-4 h-4 mr-2" /> Add Publication
                </Button>
                
                <button class="size-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <span class="text-sm font-medium">{firstName.charAt(0)}{lastName.charAt(0)}</span>
                </button>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="flex-1 bg-gray-50">
            <div class="flex justify-between items-center pt-12 px-12">
                <h2 class="text-3xl font-bold text-gray-800">My Library</h2>
                
                <Button class="bg-blue-600 hover:bg-blue-700" on:click={showAddPublicationForm}>
                    <Plus class="w-4 h-4 mr-2" /> Add Publication
                </Button>
            </div>
            
            <!-- Search Bar -->
            <div class="flex items-center justify-between px-12 pt-6 gap-4">
                <div class="relative flex-1">
                    <input
                        type="text"
                        bind:value={searchLibraryQuery}
                        class="w-full p-3 pl-10 border border-gray-300 rounded-md shadow-sm"
                        placeholder="Search publications..."
                    />
                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>
                
                <!-- Status Filter Dropdown -->
                <div class="relative">
                    <Popover.Root>
                        <Popover.Trigger asChild let:builder>
                            <button
                                class="px-4 py-3 border border-gray-300 rounded-md shadow-sm flex items-center gap-2"
                                use:builder
                            >
                                <span>{activeFilter === "all" ? "All Publications" : 
                                      activeFilter === "completed" ? "Completed" : 
                                      activeFilter === "reading" ? "In Progress" : "Unread"}</span>
                                <svg class="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                                </svg>
                            </button>
                        </Popover.Trigger>
                        
                        <Popover.Content class="w-[200px] p-2 bg-white rounded-md shadow-md">
                            <div class="space-y-1">
                                <button 
                                    class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md {activeFilter === 'all' ? 'bg-blue-50 text-blue-600 font-medium' : ''}"
                                    on:click={() => setStatusFilter('all')}
                                >
                                    All Publications
                                </button>
                                <button 
                                    class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md {activeFilter === 'reading' ? 'bg-blue-50 text-blue-600 font-medium' : ''}"
                                    on:click={() => setStatusFilter('reading')}
                                >
                                    In Progress
                                </button>
                                <button 
                                    class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md {activeFilter === 'unread' ? 'bg-blue-50 text-blue-600 font-medium' : ''}"
                                    on:click={() => setStatusFilter('unread')}
                                >
                                    Unread
                                </button>
                                <button 
                                    class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md {activeFilter === 'completed' ? 'bg-blue-50 text-blue-600 font-medium' : ''}"
                                    on:click={() => setStatusFilter('completed')}
                                >
                                    Completed
                                </button>
                            </div>
                        </Popover.Content>
                    </Popover.Root>
                </div>
            </div>
            
            <!-- Tag Filters -->
            <div class="px-12 pt-6">
                <p class="text-sm text-gray-600 mb-2">Filter by tags:</p>
                <div class="flex flex-wrap gap-2">
                    <!-- Always show All option first -->
                    <button 
                        class="px-3 py-1.5 text-sm rounded-full border {$selectedTags.length === 0 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
                        on:click={() => setTagFilter(allTagsOption)}
                    >
                        {allTagsOption}
                    </button>
                    
                    <!-- Show first 5 tags directly -->
                    {#each $uniqueTags.slice(0, 5) as tag}
                        <button 
                            class="px-3 py-1.5 text-sm rounded-full border {$selectedTags.includes(tag) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
                            on:click={() => setTagFilter(tag)}
                        >
                            {tag}
                        </button>
                    {/each}
                    
                    <!-- If there are more than 5 tags, show a More button -->
                    {#if $uniqueTags.length > 5}
                        <Popover.Root>
                            <Popover.Trigger asChild let:builder>
                                <button
                                    class="px-3 py-1.5 text-sm rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                                    use:builder
                                >
                                    + More
                                </button>
                            </Popover.Trigger>
                            
                            <Popover.Content class="w-[225px] max-h-[300px] overflow-y-auto p-4 bg-white rounded-md shadow-md">
                                <div class="space-y-2">
                                    <h3 class="font-medium mb-2">All Tags</h3>
                                    {#each $uniqueTags.slice(5) as tag}
                                        <div class="flex items-center gap-2">
                                            <input 
                                                type="checkbox" 
                                                id={`more-${tag}`} 
                                                checked={$selectedTags.includes(tag)}
                                                on:change={() => toggleTag(tag)}
                                                class="h-4 w-4 text-blue-600"
                                            />
                                            <label for={`more-${tag}`} class="text-sm text-gray-700">{tag}</label>
                                        </div>
                                    {/each}
                                </div>
                            </Popover.Content>
                        </Popover.Root>
                    {/if}
                </div>
            </div>

            <!-- Publications Grid -->
            <div class="px-12 py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {#if getFilteredBooks().length > 0}
                    {#each getFilteredBooks() as book}
                        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                            <div class="flex justify-between items-start mb-4">
                                <div class="flex-1">
                                    <h3 class="font-medium text-lg text-gray-800 line-clamp-2">{book.title}</h3>
                                    <p class="text-sm text-gray-600 mt-1">{book.author}</p>
                                </div>
                                
                                <DropdownMenu.Root>
                                    <DropdownMenu.Trigger asChild>
                                        <button class="text-gray-400 hover:text-gray-600">
                                            <Ellipsis class="h-6 w-6" />
                                        </button>
                                    </DropdownMenu.Trigger>
                                    <DropdownMenu.Content>
                                        <DropdownMenu.Item on:click={() => openViewModal(book)}>
                                            <Book class="mr-2 h-4 w-4" />
                                            <span>View Details</span>
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item on:click={() => alert("Edit not implemented")}>
                                            <Edit class="mr-2 h-4 w-4" />
                                            <span>Edit</span>
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Separator />
                                        <DropdownMenu.Item class="text-red-500" on:click={() => deletePublication(book.id)}>
                                            <Trash2 class="mr-2 h-4 w-4" />
                                            <span>Delete</span>
                                        </DropdownMenu.Item>
                                    </DropdownMenu.Content>
                                </DropdownMenu.Root>
                            </div>
                            
                            <!-- Tags -->
                            {#if book.tags && book.tags.length > 0}
                                <div class="flex flex-wrap gap-2 mt-3 mb-4">
                                    {#each book.tags as tag}
                                        <span class="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                                            {tag}
                                        </span>
                                    {/each}
                                </div>
                            {/if}
                            
                            <!-- Status and Action Button -->
                            <div class="flex justify-between items-center mt-4">
                                <span class={`px-2 py-1 text-xs rounded-full ${
                                    book.completed ? "bg-green-100 text-green-800" : 
                                    book.readingSessions?.length > 0 ? "bg-blue-100 text-blue-800" : 
                                    "bg-gray-100 text-gray-800"
                                }`}>
                                    {book.status || (book.completed ? "Completed" : book.readingSessions?.length > 0 ? "In Progress" : "Unread")}
                                </span>
                                
                                <button class="text-sm text-blue-600 hover:text-blue-800" on:click={() => openViewModal(book)}>
                                    View
                                </button>
                            </div>
                        </div>
                    {/each}
                {:else}
                    <div class="col-span-full flex flex-col items-center justify-center py-12 text-center">
                        <p class="text-lg font-medium text-gray-500">No publications found.</p>
                        <p class="text-sm text-gray-400 mt-2">Try adjusting your search or filter criteria.</p>
                        <button class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700" on:click={showAddPublicationForm}>
                            Add Your First Publication
                        </button>
                    </div>
                {/if}
            </div>
        </div>

        <!-- View Publication Modal -->
        <Dialog.Root bind:open={viewModalOpen}>
            <Dialog.Content class="w-full max-w-2xl">
                <Dialog.Header>
                    <Dialog.Title class="text-2xl font-bold">
                        {#if viewingPublication}
                            {viewingPublication.title}
                        {/if}
                    </Dialog.Title>
                    <Dialog.Description>
                        {#if viewingPublication}
                            <p class="text-lg text-gray-600 mb-4">{viewingPublication.author}</p>
                            
                            {#if viewingPublication.isbn}
                                <p class="text-sm text-gray-600">ISBN/DOI: {viewingPublication.isbn}</p>
                            {/if}
                        
                            <!-- Tags -->
                            {#if viewingPublication.tags?.length > 0}
                                <div class="flex flex-wrap gap-2 mt-6">
                                    {#each viewingPublication.tags as tag}
                                        <span class="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm">{tag}</span>
                                    {/each}
                                </div>
                            {/if}
                            
                            <!-- Divider -->
                            <hr class="my-6 border-gray-200" />
                            
                            <!-- Action Buttons -->
                            <div class="flex justify-end space-x-3">
                                <Button variant="outline" on:click={() => viewModalOpen = false}>
                                    Close
                                </Button>
                                <Button class="bg-blue-600 hover:bg-blue-700" on:click={() => alert("Edit not implemented")}>
                                    <Edit class="w-4 h-4 mr-2" /> Edit
                                </Button>
                            </div>
                        {/if}
                    </Dialog.Description>
                </Dialog.Header>
            </Dialog.Content>
        </Dialog.Root>

        <!-- Log Reading Modal -->
        <Dialog.Root bind:open={logReadingModalOpen}>
            <Dialog.Content class="w-[500px]">
                <Dialog.Header>
                    <Dialog.Title>Log Reading Session</Dialog.Title>
                    <Dialog.Description>
                        <form class="space-y-4 mt-4">
                            <!-- Publication Selection -->
                            <div class="space-y-2">
                                <label for="publication-select" class="block text-sm font-medium">
                                    Select Publication
                                </label>
                                <select 
                                    id="publication-select" 
                                    class="w-full p-2 border border-gray-300 rounded"
                                >
                                    {#if get(books).length === 0}
                                        <option value="" disabled>No publications available</option>
                                    {:else}
                                        {#each get(books) as book}
                                            <option value={book.id}>{book.title}</option>
                                        {/each}
                                    {/if}
                                </select>
                            </div>

                            <!-- Pages Read Input -->
                            <div class="space-y-2">
                                <label for="pages-read" class="block text-sm font-medium">
                                    Pages Read in This Session
                                </label>
                                <input id="pages-read" type="number" 
                                    class="w-full p-2 border border-gray-300 rounded"
                                    min="1" />
                            </div>
                            
                            <!-- Reading Duration -->
                            <div class="space-y-2">
                                <label for="reading-duration" class="block text-sm font-medium">
                                    Reading Duration (Minutes, Optional)
                                </label>
                                <input id="reading-duration" type="number" 
                                    class="w-full p-2 border border-gray-300 rounded"
                                    min="0" />
                            </div>

                            <!-- Reading Notes -->
                            <div class="space-y-2">
                                <label for="reading-notes" class="block text-sm font-medium">
                                    Reading Notes (Optional)
                                </label>
                                <textarea 
                                    id="reading-notes" 
                                    class="w-full p-2 border border-gray-300 rounded h-24"
                                    placeholder="Add notes about your reading session..."
                                ></textarea>
                            </div>

                            <!-- Action Buttons -->
                            <div class="flex justify-end space-x-3 pt-4">
                                <Button 
                                    type="button" 
                                    variant="outline"
                                    on:click={() => logReadingModalOpen = false}
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    type="button" 
                                    class="bg-blue-600 hover:bg-blue-700"
                                    on:click={() => {
                                        alert("Logging functionality not implemented in this version");
                                        logReadingModalOpen = false;
                                    }}
                                >
                                    Save Session
                                </Button>
                            </div>
                        </form>
                    </Dialog.Description>
                </Dialog.Header>
            </Dialog.Content>
        </Dialog.Root>
        
        <!-- Add Publication Modal -->
        <Dialog.Root bind:open={modalOpen}>
          <Dialog.Content class="w-[90%] max-w-4xl">
            <Dialog.Header>
              <Dialog.Title class="text-xl mb-1">
                {editMode ? "Edit Publication" : "Add Literature"}
              </Dialog.Title>
              <Dialog.Description>
                <form on:submit|preventDefault={editMode ? alert("Edit not implemented") : addLiteratureToLibrary}>
                  <!-- Search Bar -->
                  <div class="mb-4">
                    <div class="relative">
                      <label for="searchQuery" class="sr-only">Search Query</label>
                      <input 
                        type="text" 
                        id="searchQuery" 
                        bind:value={searchQuery}
                        class="w-full p-2.5 pl-10 border rounded-md border-neutral-300 shadow-sm text-neutral-700 disabled:bg-neutral-100" 
                        placeholder="Search for a book by title, ISBN, or DOI"
                        disabled={editMode}
                      />
                      <Search class="absolute top-3 left-3 w-4 h-4 text-neutral-400" />
                      <button 
                        type="button" 
                        class="absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-neutral-400"
                        on:click={searchLiterature}
                        disabled={editMode || !searchQuery.trim() || isSearching}
                      >
                        {#if isSearching}
                          Searching...
                        {:else}
                          Search
                        {/if}
                      </button>
                    </div>
                  </div>

                  <!-- Search Results -->
                  {#if showResults && searchResults.length > 0}
                    <div class="mb-6 bg-neutral-50 border border-neutral-300 rounded-md shadow-sm max-h-64 overflow-y-auto">
                      <ul class="divide-y divide-neutral-200">
                        {#each searchResults as result}
                          <li class="p-3 hover:bg-neutral-100 cursor-pointer" on:click={() => selectResult(result)}>
                            <div class="font-medium">{result.title}</div>
                            <div class="text-sm text-neutral-600">{result.author}</div>
                            {#if result.isbn}
                              <div class="text-xs text-neutral-500 mt-1">ISBN: {result.isbn}</div>
                            {/if}
                          </li>
                        {/each}
                      </ul>
                    </div>
                  {/if}

                  <!-- Publication Details -->
                  <div class="space-y-4 mt-6">
                    <h3 class="text-lg font-semibold mb-2">{editMode ? "Edit Publication Details" : "Publication Details"}</h3>
                    <div class="flex items-center">
                      <label for="title" class="w-1/4 text-sm font-medium text-neutral-700">Title *</label>
                      <input id="title" type="text" bind:value={title}
                        class="flex-1 p-1.5 pl-2 border rounded-md border-neutral-300 shadow-sm text-neutral-700" required />
                    </div>
                    <div class="flex items-center">
                      <label for="author" class="w-1/4 text-sm font-medium text-neutral-700">Author *</label>
                      <input id="author" type="text" bind:value={author}
                        class="flex-1 p-1.5 pl-2 border rounded-md border-neutral-300 shadow-sm text-neutral-700" required />
                    </div>
                    <div class="flex items-center">
                      <label for="isbn-doi" class="w-1/4 text-sm font-medium text-neutral-700">ISBN/DOI</label>
                      <input id="isbn-doi" type="text" bind:value={isbn}
                        class="flex-1 p-1.5 pl-2 border rounded-md border-neutral-300 shadow-sm text-neutral-700" autocomplete="off" />
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
                          }}
                        />
                        <button type="button"
                          class="ml-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                          on:click={addTag}>
                          Add
                        </button>
                      </div>
                      {#if tags.length > 0}
                        <div class="flex flex-wrap gap-2 mt-3">
                          {#each tags as tag, index}
                            <div class="flex items-center gap-1 bg-neutral-100 text-neutral-800 px-3 py-1 rounded-full">
                              <span>{tag}</span>
                              <button type="button" class="text-neutral-500 hover:text-neutral-800" on:click={() => removeTag(index)}>
                                &times;
                              </button>
                            </div>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  </div>

                  <!-- Submit Button -->
                  <div class="flex justify-end mt-6">
                    <Button type="button" variant="outline" class="mr-3" on:click={closeModal}>Cancel</Button>
                    <Button type="submit" class="bg-blue-600 hover:bg-blue-700">
                      {editMode ? "Update Publication" : "Add to Library"}
                    </Button>
                  </div>
                </form>
              </Dialog.Description>
            </Dialog.Header>
          </Dialog.Content>
        </Dialog.Root>
    </div>
{/if}