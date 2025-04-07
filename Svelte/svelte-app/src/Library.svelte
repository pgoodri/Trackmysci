<script>
    import { auth, firestore } from "./firebase";
    import { doc, collection, getDocs, getDoc } from "firebase/firestore";
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
        Filter 
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
    let searchQuery = "";
    
    // Modal states
    let viewModalOpen = false;
    let viewingPublication = null;
    let logReadingModalOpen = false;
    
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
            const matchesSearch = !searchQuery || 
                book.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                book.author?.toLowerCase().includes(searchQuery.toLowerCase());
                
            // Filter by tags
            const matchesTags = tags.length === 0 || 
                (book.tags && book.tags.some(tag => tags.includes(tag)));
                
            return matchesSearch && matchesTags;
        });
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
        alert("Add publication not implemented in this version");
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
        <p class="text-lg">Loading...</p>
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
            <div class="pt-12 px-12">
                <h2 class="text-4xl font-bold text-gray-800">Library</h2>
            </div>
            
            <!-- Search & Filters -->
            <div class="flex items-center px-12 py-4 gap-6">
                <!-- Search Bar -->
                <div class="relative flex-1">
                    <input
                        type="text"
                        bind:value={searchQuery}
                        class="w-full p-3 border border-gray-300 rounded-md shadow-sm"
                        placeholder="Search by title or author..."
                    />
                </div>

                <!-- Tag Filter -->
                <Popover.Root>
                    <Popover.Trigger asChild let:builder>
                        <button
                            class="px-4 py-3 border border-gray-300 rounded-md shadow-sm flex items-center gap-2"
                            use:builder
                        >
                            <Filter class="w-5 h-5" />
                            <span>Filter</span>
                        </button>
                    </Popover.Trigger>
                    
                    <Popover.Content class="w-[225px] p-5 bg-white rounded-md shadow-md">
                        <div class="space-y-4">
                            <h3 class="font-medium">Filter by Tags</h3>
                            <div class="space-y-2 max-h-60 overflow-y-auto">
                                {#each $uniqueTags as tag}
                                    <div class="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            id={tag} 
                                            checked={$selectedTags.includes(tag)}
                                            on:change={() => toggleTag(tag)}
                                            class="h-4 w-4 text-blue-600"
                                        />
                                        <label for={tag} class="text-sm text-gray-700">{tag}</label>
                                    </div>
                                {/each}
                                {#if $uniqueTags.length === 0}
                                    <p class="text-sm text-gray-500">No tags found</p>
                                {/if}
                            </div>
                            <div class="pt-2 border-t border-gray-200">
                                <button
                                    class="text-sm text-blue-600 hover:text-blue-800"
                                    on:click={() => selectedTags.set([])}
                                >
                                    Clear All Filters
                                </button>
                            </div>
                        </div>
                    </Popover.Content>
                </Popover.Root>
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
    </div>
{/if}