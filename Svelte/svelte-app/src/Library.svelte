<script>
    import { auth, firestore } from "./firebase";
    import { getDoc, doc, collection, query, where, getDocs, deleteDoc, updateDoc } from "firebase/firestore";
    import { onAuthStateChanged } from "firebase/auth";
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import { LogOut, Gauge, Library, ChevronsUpDown, Edit, Trash2, Ellipsis, SquarePen, FilePlus2 } from "lucide-svelte";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import * as Popover from "$lib/components/ui/popover";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Separator } from "$lib/components/ui/separator";
    import { Progress } from "$lib/components/ui/progress";
    import { signOut } from "firebase/auth";
    import { get } from "svelte/store"; 

    import {
      Filter
    } from "lucide-svelte";
    

    let firstName = "";
    let lastName = "";
    let authReady = false;
    let libraryList = writable([]);
    let searchQuery = "";

    let selectedTags = writable([]);
    let uniqueTags = writable([]);

    // Edit Modal variables
    let modalOpen = false;
    let editMode = false;
    let editingPublication = null;
    let title = "";
    let author = "";
    let isbn = "";
    let pageStart = 1;
    let pageEnd = 1;
    let currentPage = 1;
    let tagInput = "";
    let tags = [];

    async function fetchUserData(uid) {
        try {
            const userDoc = await getDoc(doc(firestore, "users", uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                firstName = userData.firstName || "";
                lastName = userData.lastName || "";
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    }

    async function loadUserLibrary(uid) {
    try {
        const userDocRef = doc(firestore, "users", uid);
        const libraryRef = collection(userDocRef, "library");
        const q = query(libraryRef, where("userId", "==", uid));
        const querySnapshot = await getDocs(q);

        // Use set() to update the store reactively
        const books = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Load ratings from localStorage
        const savedRatings = localStorage.getItem('publicationRatings');
        if (savedRatings) {
            const ratings = JSON.parse(savedRatings);
            books.forEach(book => {
                if (ratings[book.id]) {
                    book.rating = ratings[book.id];
                }
            });
        }
        
        // Update the store
        libraryList.set(books);
        
        extractUniqueTags();
    } catch (error) {
        console.error("Error fetching library:", error.message);
    }
}

function extractUniqueTags() {
    let allTags = new Set();
    const books = get(libraryList); // ✅ Correctly access the store

    books.forEach(item => {
        if (item.tags) {
            item.tags.forEach(tag => allTags.add(tag));
        }
    });

    uniqueTags.set([...allTags]); // ✅ Update the store with unique tags
    console.log("Extracted Tags:", [...allTags]); // Debugging log
}



function toggleTag(tag) {
    selectedTags.update(tags => {
        let newTags;
        if (tags.includes(tag)) {
            newTags = tags.filter(t => t !== tag); // Remove tag if already selected
        } else {
            newTags = [...tags, tag]; // Add tag if not selected
        }
        console.log("Updated Selected Tags:", newTags); // Debugging log
        return newTags;
    });

    filteredLibrary(); // ✅ Force UI update after toggling a tag
}



    async function deletePublication(entryId) {
        if (!confirm("Are you sure you want to delete this publication?")) return;
        try {
            const user = auth.currentUser;
            if (!user) {
                console.error("No authenticated user found.");
                return;
            }
            const userDocRef = doc(firestore, "users", user.uid);
            const entryDocRef = doc(collection(userDocRef, "library"), entryId);
            await deleteDoc(entryDocRef);
            console.log(`Deleted entry ${entryId}`);
            await loadUserLibrary(user.uid);
        } catch (error) {
            console.error("Error deleting entry:", error.message);
        }
    }

    function logout() {
        signOut(auth).then(() => {
            window.location.href = "/login";
        });
    }

    function filteredLibrary() {
    const selected = get(selectedTags); // Get selected tags
    const books = get(libraryList); // Get the latest library data

    return books.filter(lit => {
        const matchesSearch = lit.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              lit.author?.toLowerCase().includes(searchQuery.toLowerCase());

        const tags = lit.tags || []; // Ensure it's always an array
        const matchesTags = selected.length === 0 || tags.some(tag => selected.includes(tag));

        return matchesSearch && matchesTags;
    });
}






    onMount(() => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                await fetchUserData(user.uid);
                await loadUserLibrary(user.uid);
            }
            authReady = true;
        });
    });

    // ----- Modal Functions -----
    function openEditModal(pub) {
        editMode = true;
        editingPublication = { ...pub };
        // Pre-fill modal fields with publication data
        title = pub.title;
        author = pub.author;
        isbn = pub.isbn;
        pageStart = pub.pageStart;
        pageEnd = pub.pageEnd;
        currentPage = pub.currentPage;
        tags = pub.tags || [];
        modalOpen = true;
    }
  
    function closeModal() {
        modalOpen = false;
        editMode = false;
        editingPublication = null;
        resetFields();
    }
    
    function resetFields() {
        title = author = isbn = "";
        pageStart = pageEnd = currentPage = 1;
        tagInput = "";
        tags = [];
    }
    
    // Tag functions
    function addTag() {
        if (tagInput.trim() && !tags.includes(tagInput.trim())) {
            tags = [...tags, tagInput.trim()];
            tagInput = "";
        }
    }
    
    function removeTag(index) {
        tags = tags.filter((_, i) => i !== index);
    }

    async function updateEditedPublication() {
        if (!editingPublication) return;
        const user = auth.currentUser;
        if (!user) {
            console.error("No authenticated user found.");
            return;
        }

        try {
            const userDocRef = doc(firestore, "users", user.uid);
            const entryDocRef = doc(collection(userDocRef, "library"), editingPublication.id);

            // Fetch the existing data before update
            const entryDocSnap = await getDoc(entryDocRef);
            if (!entryDocSnap.exists()) {
                console.warn("Publication not found for editing.");
                return;
            }

            const updatedData = {
                title,
                author,
                isbn,
                pageStart,
                pageEnd,
                currentPage,
                tags: Array.isArray(tags) ? tags.map(tag => tag.trim()) : [],
                updatedAt: new Date()
            };

            // Save updated publication data
            await updateDoc(entryDocRef, updatedData);
            console.log(`Updated publication: ${editingPublication.id}`);

            // Update the store to reflect changes in UI
            libraryList.update(books => {
                return books.map(book => 
                    book.id === editingPublication.id ? { ...book, ...updatedData } : book
                );
            });

            // Refresh tags
            extractUniqueTags();
            closeModal();
        } catch (error) {
            console.error("Error updating publication:", error.message);
        }
    }
</script>

{#if !authReady}
    <div class="flex justify-center items-center h-screen bg-white">
        <p class="text-neutral-500 text-lg">Loading...</p>
    </div>
{:else}
    <div class="min-h-screen flex flex-col bg-stone-50">
        <!-- NAVBAR -->
        <nav class="bg-white border-neutral-400 shadow h-16 flex items-center justify-between px-12 sticky top-0 z-50">
            <h1 class="text-lg font-semibold text-neutral-800">TrackMySci</h1>
            <div class="flex items-center space-x-6">
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                        <button class="border border-neutral-300 py-2 px-4 shadow-sm text-base font-medium rounded hover:bg-neutral-100 flex items-center gap-x-5">
                            {firstName} {lastName}
                            <ChevronsUpDown class="w-4 h-4 text-neutral-800" />
                        </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content>
                        <DropdownMenu.Group>
                            <DropdownMenu.Item on:click={() => window.location.href = "/dashboard"} class="text-base">
                                <Gauge class="w-7 pr-1.5" /> Dashboard
                            </DropdownMenu.Item>
                            <DropdownMenu.Item on:click={() => window.location.href = "/library"} class="text-base">
                                <Library class="w-7 pr-1.5" /> Library
                            </DropdownMenu.Item>
                            <DropdownMenu.Separator />
                            <DropdownMenu.Item on:click={logout} class="text-red-500 text-base">
                                <LogOut class="w-7 pr-1.5 text-red-500" /> Logout
                            </DropdownMenu.Item>
                        </DropdownMenu.Group>
                    </DropdownMenu.Content>
                </DropdownMenu.Root>
            </div>
        </nav>

        <!-- PAGE CONTENT -->
        <div class="pt-12 px-12">
            <h2 class="text-4xl font-bold text-neutral-800">Library</h2>
        </div>

        <!-- Search & Tag Filter Container (Aligned Side by Side) -->
        <div class="flex items-center px-12 py-4 gap-6">
        <!-- Search Bar with Icon -->
        <div class="relative flex-1">
            <input
            type="text"
            bind:value={searchQuery}
            class="w-full p-3 border border-neutral-300 rounded-md shadow-sm text-neutral-700"
            placeholder="Search by title or author..."
        />
        </div>

        <!-- Filter by Tags Section -->
        <div class="flex flex-col">
            <!-- Filter by Tags Title -->
            <div class="flex items-start gap-2 mb-2">
                <Filter />
                <span class="text-gray-700 font-semibold text-base">Filter by Tags</span>
            </div>

            <!-- Tags Displayed Inline -->
            <div class="flex flex-wrap gap-2 w-[450px]">
                {#each $uniqueTags as tag}
                    <button 
                        class="px-4 py-1.5 text-sm font-medium rounded-full border transition-all shadow-sm"
                        class:active={$selectedTags.includes(tag)}
                        on:click={() => toggleTag(tag)}
                        style="background-color: {$selectedTags.includes(tag) ? '#2563EB' : '#F3F4F6'}; 
                            color: {$selectedTags.includes(tag) ? 'white' : '#374151'};
                            font-weight: 500;">
                        {tag}
                    </button>
                {/each}
            </div>
        </div>
        </div>

        <div class="flex flex-1">
            <section class="w-full  px-12">
                {#if filteredLibrary().length === 0}
                    <div class="flex flex-col items-center justify-center text-center text-gray-500 pt-12">
                        <p class="text-lg font-medium">No publications found.</p>
                    </div>
                {:else}
                    <!-- Grid layout for 3-column structure -->
                    <ul class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {#each $libraryList.filter(lit => {
                            const matchesSearch = lit.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                  lit.author?.toLowerCase().includes(searchQuery.toLowerCase());
                        
                            const tags = lit.tags || []; // Ensure it's always an array
                            const matchesTags = $selectedTags.length === 0 || tags.some(tag => $selectedTags.includes(tag));
                        
                            return matchesSearch && matchesTags;
                        }) as lit}
                        <li class="p-4 bg-white border border-neutral-300 rounded-md shadow">
                            <div class="flex justify-between">
                                <div class="cursor-pointer">
                                    <strong>{lit.title}</strong><br />
                                    <small>{lit.author}</small>
                                </div>
                                <div>
                                    <DropdownMenu.Root>
                                        <DropdownMenu.Trigger>
                                            <button class="p-0.5 text-gray-800 hover:bg-gray-200 rounded-sm">
                                                <Ellipsis class="w-5 h-5" />
                                            </button>
                                        </DropdownMenu.Trigger>
                                        <DropdownMenu.Content>
                                            <DropdownMenu.Group>
                                                <DropdownMenu.Item on:click={() => openEditModal(lit)} class="text-sm">
                                                    <Edit class="w-4 h-4 mr-2" /> Edit
                                                </DropdownMenu.Item>
                                                <DropdownMenu.Item class="text-sm text-red-600" on:click={() => deletePublication(lit.id)}>
                                                    <Trash2 class="w-4 h-4 mr-2" /> Delete
                                                </DropdownMenu.Item>
                                            </DropdownMenu.Group>
                                        </DropdownMenu.Content>
                                    </DropdownMenu.Root>
                                </div>
                            </div>

                            <!-- Rating Display -->
                            {#if lit.rating !== undefined && lit.rating > 0}
                            <div class="mt-2">
                                <div class="flex items-center">
                                    {#each Array(5) as _, i}
                                        <span class="text-lg">
                                            {#if i < lit.rating}
                                                <span class="text-yellow-400">★</span>
                                            {:else}
                                                <span class="text-gray-300">★</span>
                                            {/if}
                                        </span>
                                    {/each}
                                </div>
                            </div>
                            {/if}

                            {#if lit.tags?.length > 0}
                                <div class="flex flex-wrap gap-2 mt-3">
                                    {#each lit.tags as tag}
                                        <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">{tag}</span>
                                    {/each}
                                </div>
                            {/if}

                            <div class="mt-1 flex items-center gap-3">
                                <div class="flex-1">
                                    <div class="flex justify-between text-sm text-neutral-600 mb-1">
                                        <span>
                                            {Math.min(100, Math.round(((lit.currentPage || lit.pageStart) - lit.pageStart) / (lit.pageEnd - lit.pageStart) * 100))}%
                                        </span>
                                    </div>
                                    <Progress value={Math.min(100, Math.round(((lit.currentPage || lit.pageStart) - lit.pageStart) / (lit.pageEnd - lit.pageStart) * 100))} />
                                </div>
                            </div>
                        </li>
                        {/each}
                    </ul>
                {/if}
            </section>
        </div>
    </div>
{/if}

<!-- Edit Publication Dialog -->
<Dialog.Root bind:open={modalOpen}>
    <Dialog.Content class="w-[90%] max-w-4xl">
        <Dialog.Header>
            <Dialog.Title class="text-xl mb-1">
                Edit Publication
            </Dialog.Title>
            <Dialog.Description>
                <form on:submit|preventDefault={updateEditedPublication}>
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
                            <div class="flex-1">
                                <label for="current-page" class="text-sm font-medium text-neutral-700">Current Page *</label>
                                <input id="current-page" type="number" bind:value={currentPage}
                                    class="w-full p-1.5 pl-2 border rounded-md border-neutral-300 shadow-sm text-neutral-700" min={pageStart} max={pageEnd} />
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
                    </div>

                    <!-- Footer Buttons -->
                    <div class="flex justify-end space-x-4 mt-4">
                        <Button type="button" on:click={closeModal} class="bg-neutral-200 text-neutral-700 hover:bg-neutral-300">Cancel</Button>
                        <Button type="submit" class="bg-blue-600 text-white hover:bg-blue-700">Update</Button>
                    </div>
                </form>
            </Dialog.Description>
        </Dialog.Header>
    </Dialog.Content>
</Dialog.Root>
