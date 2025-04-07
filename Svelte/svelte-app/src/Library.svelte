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
        Search,
        Clock,
        Calendar
    } from "lucide-svelte";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import * as Dialog from "$lib/components/ui/dialog";
    import * as Popover from "$lib/components/ui/popover";
    import { Button } from "$lib/components/ui/button";
    import { Separator } from "$lib/components/ui/separator";

    // State
    let isLoading = true;
    let firstName = "User";
    let lastName = "";
    
    // Initialize writable stores
    const books = writable([]);
    const selectedTags = writable([]);
    const uniqueTags = writable([]);
    const filteredBooks = writable([]);
    
    // Search and filter
    let searchLibraryQuery = ""; // Renamed to avoid conflict with form searchQuery
    let activeFilter = "all"; // Options: all, unread, reading, completed
    
    // Subscribe to changes in books, selectedTags, or filter criteria
    // and update filteredBooks whenever any of these change
    const unsubscribe = [
        books.subscribe(() => updateFilteredBooks()),
        selectedTags.subscribe(() => updateFilteredBooks())
    ];
    
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
    
    // Rating dialog variables
    let ratingDialogOpen = false;
    let currentRating = 0;
    let publicationToRate = null;
    let publicationTitleToRate = "";
    let markCompletedWithRating = false;
    
    // Log Reading modal variables
    let logReadingPublication = null;
    let logReadingPagesRead = 0;
    let logReadingComment = "";
    let logReadingDuration = 0;
    
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
            
            // Initialize filtered books
            updateFilteredBooks();
        } catch (error) {
            console.error("Error loading books:", error);
            books.set([]);
        }
    }
    
    // Update filtered books based on current filters
    function updateFilteredBooks() {
        const allBooks = get(books);
        const tags = get(selectedTags);
        
        const result = allBooks.filter(book => {
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
        
        filteredBooks.set(result);
        console.log("Filtered books updated:", result.length, "matches");
        console.log("Selected tags:", tags);
    }
    
    // Get filtered books (just returns the current value of the store)
    function getFilteredBooks() {
        return get(filteredBooks);
    }
    
    // Set active filter by status
    function setStatusFilter(status) {
        activeFilter = status;
        updateFilteredBooks();
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
    
    function closeViewModal() {
        viewingPublication = null;
        viewModalOpen = false;
    }
    
    // Function to open the log reading modal
    function openLogReadingModal() {
        // If there are publications in the library, select the first one by default
        const booksList = get(books);
        if (booksList.length > 0) {
            logReadingPublication = booksList[0].id;
        }
        logReadingPagesRead = 0;
        logReadingComment = "";
        logReadingDuration = 0;
        logReadingModalOpen = true;
    }

    // Function to save reading log via modal
    async function saveReadingLog() {
        if (!logReadingPublication || !logReadingPagesRead) {
            alert("Please select a publication and enter pages read");
            return;
        }
        
        const publication = get(books).find(p => p.id === logReadingPublication);
        if (publication) {
            await updateProgress(
                logReadingPublication, 
                logReadingPagesRead, 
                logReadingComment,
                logReadingDuration
            );
            logReadingModalOpen = false;
        }
    }
    
    // Function to handle publication selection in the log reading modal
    function handlePublicationSelection(pubId) {
        logReadingPublication = pubId;
        logReadingPagesRead = 0; // Reset pages read since this is a new session
        logReadingDuration = 0; // Reset duration
    }
    
    // Update reading progress for a publication
    async function updateProgress(entryId, pagesRead, comment, duration = 0) {
        const user = auth.currentUser;
        if (!user) {
            console.error("No authenticated user found.");
            return;
        }
        
        try {
            const userDocRef = doc(firestore, "users", user.uid);
            const entryDocRef = doc(collection(userDocRef, "library"), entryId);
            const summaryDocRef = doc(collection(userDocRef, "charts"), "summary");
            
            const entryDocSnap = await getDoc(entryDocRef);
            const summaryDocSnap = await getDoc(summaryDocRef);
            
            let readingSessions = [];
            let streak = 0;
            let streakDate = null;
            let today = new Date().toISOString().split("T")[0]; // Get current date (YYYY-MM-DD)
            let readingLog = [];
            
            if (entryDocSnap.exists()) {
                const entryData = entryDocSnap.data();
                readingSessions = entryData.readingSessions || [];
            }
            
            if (summaryDocSnap.exists()) {
                const summaryData = summaryDocSnap.data();
                streak = summaryData.streak || 0;
                streakDate = summaryData.streakDate || null;
                readingLog = summaryData.readingLog || [];
            }
            
            // Create reading session entry
            const sessionEntry = {
                dateTitle: new Date().toLocaleDateString(),
                pagesRead: pagesRead,
                notes: comment || "",
                duration: duration,
                date: new Date().toISOString()
            };
            
            readingSessions.push(sessionEntry);
            
            // Streak Logic
            if (!streakDate) {
                streak = 1;
                streakDate = today;
            } else {
                const lastLogDate = new Date(streakDate);
                const timeDiff = Math.floor((new Date(today) - lastLogDate) / (1000 * 60 * 60 * 24));
                
                if (timeDiff === 1) {
                    streak += 1;
                    streakDate = today;
                } else if (timeDiff > 1) {
                    streak = 1; // Reset to 1 since user is reading today
                    streakDate = today;
                }
            }
            
            // Update Reading Log (for Timeline Chart)
            let updatedLog = readingLog.map(log => ({ ...log })); // Clone array to avoid mutation
            
            // Check if today already exists in log, update instead of adding duplicate
            let todayLogIndex = updatedLog.findIndex(log => log.date === today);
            if (todayLogIndex !== -1) {
                updatedLog[todayLogIndex].pagesRead += pagesRead; // Aggregate pages read for today
            } else {
                updatedLog.unshift({ date: today, pagesRead }); // Add new entry for today
            }
            
            // Ensure we only keep logs within 90 days
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 90);
            
            // Remove outdated logs from Firestore
            updatedLog = updatedLog.filter(log => new Date(log.date) >= cutoffDate);
            
            // Update publication status if not already marked as complete
            const entryData = entryDocSnap.data();
            let status = entryData.status || "unread";
            if (status === "unread" && !entryData.completed) {
                status = "in progress";
            }
            
            // Update Firestore
            await updateDoc(entryDocRef, {
                readingSessions: readingSessions,
                updatedAt: new Date(),
                totalPagesRead: (entryData.totalPagesRead || 0) + pagesRead,
                status: status
            });
            
            await setDoc(summaryDocRef, {
                mostRecent: entryDocSnap.data().title,
                updatedAt: new Date(),
                streak: streak,
                streakDate: streakDate,
                readingLog: updatedLog
            }, { merge: true });
            
            console.log(`Updated streak to ${streak} days, streakDate: ${streakDate}`);
            console.log("Updated reading log for timeline chart:", updatedLog);
            
            // Ensure UI updates properly
            if (viewingPublication && viewingPublication.id === entryId) {
                viewingPublication.readingSessions = readingSessions;
                viewingPublication.totalPagesRead = (viewingPublication.totalPagesRead || 0) + pagesRead;
                viewingPublication.status = status;
            }
            
            // Reload library data to update UI
            await loadUserLibrary(user.uid);
            
        } catch (error) {
            console.error("Error updating progress:", error.message);
        }
    }
    
    function logout() {
        signOut(auth).then(() => {
            window.location.href = "/login";
        });
    }
    
    function openAddModal() {
        // Reset form fields
        editMode = false;
        editingPublication = null;
        resetFields();
        modalOpen = true;
    }
    
    // Open modal in "edit" mode (for editing an existing publication)
    function openEditModal(pub) {
        editMode = true;
        editingPublication = { ...pub };
        // Pre-fill modal fields with publication data
        searchQuery = pub.title;
        title = pub.title;
        author = pub.author;
        isbn = pub.isbn || "";
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
    
    // Update an existing publication
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
            
            const oldData = entryDocSnap.data();
            
            const updatedData = {
                title,
                author,
                isbn,
                tags: Array.isArray(tags) ? tags.map(tag => tag.trim()) : [],
                updatedAt: new Date()
            };
            
            // Save updated publication data
            await updateDoc(entryDocRef, updatedData);
            console.log(`Updated publication: ${editingPublication.id}`);
            
            // Update UI by reloading library
            await loadUserLibrary(user.uid);
            
            // If the publication is currently being viewed, update the view
            if (viewingPublication && viewingPublication.id === editingPublication.id) {
                viewingPublication = {
                    ...viewingPublication,
                    title: updatedData.title,
                    author: updatedData.author,
                    isbn: updatedData.isbn,
                    tags: updatedData.tags
                };
            }
            
            closeModal();
            
        } catch (error) {
            console.error("Error updating publication:", error.message);
            alert("Failed to update publication. Please try again.");
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
    
    // Function to show rating dialog
    function showRatingDialog(pubId, pubTitle) {
        publicationToRate = pubId;
        publicationTitleToRate = pubTitle;
        currentRating = 0;
        ratingDialogOpen = true;
    }
    
    // Function to save rating
    async function saveRating() {
        if (currentRating === 0) return;
        
        // For now just close the dialog, future implementation will save to Firestore
        ratingDialogOpen = false;
        alert("Rating saved!");
    }
    
    // Function to toggle publication completion status
    async function toggleCompletionStatus(publicationId) {
        const user = auth.currentUser;
        if (!user) {
            console.error("No authenticated user found.");
            return;
        }
        
        try {
            // Find the publication
            const booksList = get(books);
            const publication = booksList.find(p => p.id === publicationId);
            if (!publication) return;
            
            const newStatus = !publication.completed;
            
            const userDocRef = doc(firestore, "users", user.uid);
            const libraryRef = doc(userDocRef, "library", publicationId);
            
            // Update Firestore
            await updateDoc(libraryRef, { 
                completed: newStatus, 
                status: newStatus ? "completed" : 
                        (publication.readingSessions && publication.readingSessions.length > 0) 
                        ? "in progress" : "unread",
                updatedAt: new Date()
            });
            
            // Update local state
            books.update(currentBooks => 
                currentBooks.map(book => 
                    book.id === publicationId 
                    ? { 
                        ...book, 
                        completed: newStatus, 
                        status: newStatus ? "completed" : 
                                (book.readingSessions && book.readingSessions.length > 0) 
                                ? "in progress" : "unread"
                    } 
                    : book
                )
            );
            
            // If setting to completed, show rating dialog
            if (newStatus) {
                showRatingDialog(publicationId, publication.title);
            }
            
            // If viewing this publication, update the viewing state as well
            if (viewingPublication && viewingPublication.id === publicationId) {
                viewingPublication = {
                    ...viewingPublication,
                    completed: newStatus,
                    status: newStatus ? "completed" : 
                            (viewingPublication.readingSessions && viewingPublication.readingSessions.length > 0) 
                            ? "in progress" : "unread"
                };
            }
            
            console.log(`✅ Publication ${publicationId} ${newStatus ? "marked as completed" : "marked as incomplete"}`);
        } catch (error) {
            console.error(`❌ Error changing completion status:`, error.message);
        }
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
        
        // Return cleanup function to unsubscribe from auth state changes and store subscriptions
        return () => {
            unsubscribe();
            
            // Unsubscribe from store subscriptions
            unsubscribe.forEach(unsub => unsub());
        };
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
                
                <Button class="bg-blue-600 hover:bg-blue-700" on:click={openAddModal}>
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
                
                <Button class="bg-blue-600 hover:bg-blue-700" on:click={openAddModal}>
                    <Plus class="w-4 h-4 mr-2" /> Add Publication
                </Button>
            </div>
            
            <!-- Search Bar -->
            <div class="flex items-center justify-between px-12 pt-6 gap-4">
                <div class="relative flex-1">
                    <input
                        type="text"
                        bind:value={searchLibraryQuery}
                        on:input={updateFilteredBooks}
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

            <!-- Publications List -->
            <div class="px-12 py-6">
                {#if getFilteredBooks().length > 0}
                    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <!-- List items -->
                        {#each getFilteredBooks() as book}
                            <div class="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors" on:click={() => openViewModal(book)}>
                                <div class="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                                    <!-- Book Title and Author -->
                                    <div class="flex-1">
                                        <h3 class="font-medium text-lg text-gray-800">{book.title}</h3>
                                        <p class="text-sm text-gray-600 mt-1">{book.author}</p>
                                        
                                        <!-- Tags -->
                                        {#if book.tags && book.tags.length > 0}
                                            <div class="flex flex-wrap gap-1.5 mt-2">
                                                {#each book.tags.slice(0, 3) as tag}
                                                    <span class="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-800 rounded-full">
                                                        {tag}
                                                    </span>
                                                {/each}
                                                {#if book.tags.length > 3}
                                                    <span class="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                                                        +{book.tags.length - 3} more
                                                    </span>
                                                {/if}
                                            </div>
                                        {/if}
                                    </div>
                                    
                                    <!-- Reading Stats -->
                                    <div class="flex flex-row sm:flex-col items-center sm:items-end gap-4 sm:gap-1">
                                        <div class="flex items-center gap-2">
                                            <span class={`px-2 py-1 text-xs rounded-full ${
                                                book.completed ? "bg-green-100 text-green-800" : 
                                                book.readingSessions?.length > 0 ? "bg-blue-100 text-blue-800" : 
                                                "bg-gray-100 text-gray-800"
                                            }`}>
                                                {book.status || (book.completed ? "Completed" : book.readingSessions?.length > 0 ? "In Progress" : "Unread")}
                                            </span>
                                            
                                            {#if book.readingSessions && book.readingSessions.length > 0}
                                                <span class="text-xs text-gray-500">
                                                    {book.totalPagesRead || 0} pages read
                                                </span>
                                            {/if}
                                        </div>
                                        
                                        <div class="flex items-center gap-2">
                                            <button class="text-sm text-blue-600 hover:text-blue-800" on:click={(e) => {e.stopPropagation(); openViewModal(book);}}>
                                                View
                                            </button>
                                            
                                            <DropdownMenu.Root>
                                                <DropdownMenu.Trigger asChild>
                                                    <button class="text-gray-400 hover:text-gray-600" on:click={(e) => e.stopPropagation()}>
                                                        <Ellipsis class="h-5 w-5" />
                                                    </button>
                                                </DropdownMenu.Trigger>
                                                <DropdownMenu.Content>
                                                    <DropdownMenu.Item on:click={() => openViewModal(book)}>
                                                        <Book class="mr-2 h-4 w-4" />
                                                        <span>View Details</span>
                                                    </DropdownMenu.Item>
                                                    <DropdownMenu.Item on:click={() => openEditModal(book)}>
                                                        <Edit class="mr-2 h-4 w-4" />
                                                        <span>Edit Details</span>
                                                    </DropdownMenu.Item>
                                                    <DropdownMenu.Item on:click={() => toggleCompletionStatus(book.id)}>
                                                        <Book class="mr-2 h-4 w-4" />
                                                        <span>{book.completed ? 'Mark as Incomplete' : 'Mark as Complete'}</span>
                                                    </DropdownMenu.Item>
                                                    <DropdownMenu.Separator />
                                                    <DropdownMenu.Item class="text-red-500" on:click={() => deletePublication(book.id)}>
                                                        <Trash2 class="mr-2 h-4 w-4" />
                                                        <span>Delete</span>
                                                    </DropdownMenu.Item>
                                                </DropdownMenu.Content>
                                            </DropdownMenu.Root>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <div class="flex flex-col items-center justify-center py-12 text-center bg-white rounded-xl shadow-sm border border-gray-100">
                        <p class="text-lg font-medium text-gray-500">No publications found.</p>
                        <p class="text-sm text-gray-400 mt-2">Try adjusting your search or filter criteria.</p>
                        <button class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700" on:click={openAddModal}>
                            Add Your First Publication
                        </button>
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}

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
                    <p class="text-lg text-neutral-600 mb-4">{viewingPublication.author}</p>
                    
                    {#if viewingPublication.isbn}
                        <p class="text-sm text-neutral-600">ISBN/DOI: {viewingPublication.isbn}</p>
                    {/if}
                
                    <div class="flex items-center gap-2 mt-4 mb-2">
                        <Book class="w-5 h-5 text-neutral-600" />
                        <span class="text-neutral-700">
                            {viewingPublication.totalPagesRead || 0} pages read in {viewingPublication.readingSessions?.length || 0} sessions
                        </span>
                    </div>
                    
                    <!-- Status Bar -->
                    <div class="mb-6">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-sm text-neutral-600">Status:</span>
                            <span class={`px-3 py-1 rounded-full text-sm ${
                                viewingPublication.completed ? "bg-green-100 text-green-800" : 
                                viewingPublication.readingSessions?.length > 0 ? "bg-blue-100 text-blue-800" : 
                                "bg-gray-100 text-gray-800"
                            }`}>
                                {viewingPublication.status || (viewingPublication.completed ? "Completed" : viewingPublication.readingSessions?.length > 0 ? "In Progress" : "Unread")}
                            </span>
                        </div>
                    </div>
                    
                    <!-- Tags -->
                    {#if viewingPublication.tags?.length > 0}
                        <div class="flex flex-wrap gap-2 mb-6">
                            {#each viewingPublication.tags as tag}
                                <span class="bg-neutral-100 text-neutral-800 px-3 py-1 rounded-full text-sm">{tag}</span>
                            {/each}
                        </div>
                    {/if}
                    
                    <!-- Divider -->
                    <hr class="my-6 border-neutral-200" />
                    
                    <!-- Reading Logs Section -->
                    <div>
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-lg font-semibold">Reading Logs</h3>
                            <div class="flex items-center gap-2">
                                <Button 
                                    class="flex items-center gap-2" 
                                    variant="outline"
                                    on:click={() => {
                                        if (viewingPublication) {
                                            openEditModal(viewingPublication);
                                            viewModalOpen = false; // Close the view modal when opening the edit modal
                                        }
                                    }}
                                >
                                    <Edit class="w-4 h-4" />
                                    Edit Details
                                </Button>
                                <Button 
                                    class="flex items-center gap-2" 
                                    variant="outline"
                                    on:click={() => {
                                        logReadingPublication = viewingPublication.id;
                                        logReadingPagesRead = 0;
                                        logReadingComment = "";
                                        logReadingDuration = 0;
                                        logReadingModalOpen = true;
                                        viewModalOpen = false; // Close the view modal when opening the log modal
                                    }}
                                >
                                    <BookOpen class="w-5 h-5" />
                                    Log Reading
                                </Button>
                            </div>
                        </div>
                        
                        {#if viewingPublication.readingSessions?.length > 0}
                            <div class="space-y-4">
                                <div class="flex justify-between items-center mb-2">
                                    <h3 class="text-lg font-semibold text-neutral-800">Reading Sessions</h3>
                                    <div class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                                        {viewingPublication.status || "Unknown"}
                                    </div>
                                </div>
                            
                                <div class="bg-neutral-50 p-3 rounded-md mb-4">
                                    <div class="flex items-center gap-3 text-neutral-700">
                                        <div>
                                            <span class="text-3xl font-bold">{viewingPublication.totalPagesRead || 0}</span>
                                            <span class="text-sm ml-1">total pages read</span>
                                        </div>
                                        <Separator orientation="vertical" class="h-8" />
                                        <div>
                                            <span class="text-3xl font-bold">{viewingPublication.readingSessions.length}</span>
                                            <span class="text-sm ml-1">sessions</span>
                                        </div>
                                    </div>
                                </div>
                            
                                {#each viewingPublication.readingSessions as session}
                                    <div class="bg-white border border-neutral-200 rounded-lg p-4">
                                        <div class="flex justify-between mb-2">
                                            <div class="flex items-center gap-2 text-neutral-600">
                                                <Calendar class="w-4 h-4" />
                                                <span>{new Date(session.date).toLocaleDateString()}</span>
                                            </div>
                                            {#if session.duration}
                                            <div class="flex items-center gap-1 text-neutral-600 text-sm">
                                                <Clock class="w-3 h-3" />
                                                <span>{session.duration} min</span>
                                            </div>
                                            {/if}
                                        </div>
                                        
                                        <div class="flex items-center gap-2 mb-2 text-neutral-600">
                                            <Book class="w-4 h-4" />
                                            <span>{session.pagesRead} pages read</span>
                                        </div>
                                        
                                        {#if session.notes}
                                            <p class="text-neutral-700 bg-neutral-50 p-3 rounded-md mt-2">{session.notes}</p>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <div class="text-center p-6 bg-neutral-50 rounded-lg">
                                <p class="text-neutral-500">No reading sessions yet.</p>
                                <p class="text-sm text-neutral-400 mt-1">Start tracking your reading by clicking "Log Reading".</p>
                            </div>
                        {/if}

                        <!-- Mark as Complete/Incomplete button -->
                        <div class="mt-6">
                            <Button 
                                class="w-full {viewingPublication?.completed ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'}"
                                on:click={() => toggleCompletionStatus(viewingPublication.id)}
                            >
                                {viewingPublication?.completed ? 'Mark as Incomplete' : 'Mark as Complete'}
                            </Button>
                        </div>
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
                <form on:submit|preventDefault={saveReadingLog} class="space-y-4 mt-4">
                    <!-- Publication Selection -->
                    <div class="space-y-2">
                        <label for="publication-select" class="block text-sm font-medium">
                            Select Publication
                        </label>
                        <select 
                            id="publication-select" 
                            class="w-full p-2 border border-neutral-300 rounded"
                            bind:value={logReadingPublication}
                            on:change={() => handlePublicationSelection(logReadingPublication)}
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
                        <input id="pages-read" type="number" bind:value={logReadingPagesRead} 
                            class="w-full p-2 border border-neutral-300 rounded"
                            min="1" />
                    </div>
                    
                    <!-- Reading Duration (Optional) -->
                    <div class="space-y-2">
                        <label for="reading-duration" class="block text-sm font-medium">
                            Reading Duration (Minutes, Optional)
                        </label>
                        <input id="reading-duration" type="number" bind:value={logReadingDuration} 
                            class="w-full p-2 border border-neutral-300 rounded"
                            min="0" />
                    </div>

                    <!-- Reading Notes -->
                    <div class="space-y-2">
                        <label for="reading-notes" class="block text-sm font-medium">
                            Reading Notes (Optional)
                        </label>
                        <textarea 
                            id="reading-notes" 
                            bind:value={logReadingComment} 
                            class="w-full p-2 border border-neutral-300 rounded h-24"
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
                            type="submit" 
                            class="bg-blue-600 hover:bg-blue-700"
                        >
                            Save Session
                        </Button>
                    </div>
                </form>
            </Dialog.Description>
        </Dialog.Header>
    </Dialog.Content>
</Dialog.Root>

<!-- Rating Dialog -->
{#if ratingDialogOpen}
<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h2 class="text-xl font-bold mb-4">Rate this publication</h2>
        <p class="mb-4">Congratulations on finishing "{publicationTitleToRate}"! How would you rate it?</p>
        
        <div class="flex items-center justify-center space-x-2 mb-6">
            {#each Array(5) as _, i}
                <button 
                    type="button"
                    on:click={() => currentRating = i + 1}
                    class="text-3xl focus:outline-none transition-transform hover:scale-110"
                >
                    {#if i < currentRating}
                        <span class="text-yellow-400">★</span>
                    {:else}
                        <span class="text-gray-300">★</span>
                    {/if}
                </button>
            {/each}
        </div>
        
        <div class="flex justify-end space-x-3">
            <button 
                class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
                on:click={() => ratingDialogOpen = false}
            >
                Skip
            </button>
            <button 
                class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                on:click={saveRating}
                disabled={currentRating === 0}
            >
                Save Rating
            </button>
        </div>
    </div>
</div>
{/if}

<!-- Add Publication Modal -->
<Dialog.Root bind:open={modalOpen}>
  <Dialog.Content class="w-[90%] max-w-4xl">
    <Dialog.Header>
      <Dialog.Title class="text-xl mb-1">
        {editMode ? "Edit Publication" : "Add Literature"}
      </Dialog.Title>
      <Dialog.Description>
        <form on:submit|preventDefault={editMode ? updateEditedPublication : addLiteratureToLibrary}>
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