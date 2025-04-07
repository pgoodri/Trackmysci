<script>
    import { auth, firestore } from "./firebase";
    import { doc, collection, getDocs, getDoc, addDoc, updateDoc, setDoc, deleteDoc, query, where } from "firebase/firestore";
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
        Calendar,
        ArrowUpDown,
        ChevronDown,
        X,
        CheckCircle2,
        BookmarkIcon,
        Tag,
        LayoutGrid,
        List
    } from "lucide-svelte";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import * as Dialog from "$lib/components/ui/dialog";
    import * as Popover from "$lib/components/ui/popover";
    import { Button } from "$lib/components/ui/button";
    import { Separator } from "$lib/components/ui/separator";
    import { Progress } from "$lib/components/ui/progress";
    import { Input } from "$lib/components/ui/input";

    // State
    let isLoading = true;
    let firstName = "User";
    let lastName = "";
    let currentPage = 1;
    let itemsPerPage = 9; // Default for grid view
    
    // Initialize writable stores
    const books = writable([]);
    const uniqueTags = writable([]);
    const filteredBooks = writable([]);
    
    // Search and filter states
    let searchLibraryQuery = "";
    let selectedStatusFilter = "all";
    let selectedTagFilter = "all";
    let sortOrder = "newest"; // Options: newest, oldest, title-asc, title-desc
    
    // View mode state
    let viewMode = localStorage.getItem("library-view-mode") || "grid"; // Options: grid, list
    
    // Create a reactive count to force re-rendering
    const refreshCounter = writable(0);
    
    // Subscribe to changes in books or filter criteria
    // and update filteredBooks whenever any of these change
    const unsubscribe = [
        books.subscribe(() => updateFilteredBooks()),
        refreshCounter.subscribe(() => updateFilteredBooks())
    ];
    
    // Function to force a UI refresh
    function forceRefresh() {
        refreshCounter.update(n => n + 1);
    }
    
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
            console.log("Loading library for user:", uid);
            const userDocRef = doc(firestore, "users", uid);
            const libraryRef = collection(userDocRef, "library");
            const querySnapshot = await getDocs(libraryRef);
            
            console.log(`Found ${querySnapshot.docs.length} books in library`);
            
            const loadedBooks = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // Ensure createdAt is a Date for proper sorting
                    createdAt: data.createdAt?.toDate?.() || new Date()
                };
            });
            
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
            
            // Force a refresh
            forceRefresh();
            
            console.log("Library loaded successfully");
        } catch (error) {
            console.error("Error loading books:", error);
            books.set([]);
        } finally {
            isLoading = false;
        }
    }
    
    // Calculate reading progress percentage
    function calculateProgress(book) {
        if (!book) return 0;
        
        // If the book is marked as completed, return 100%
        if (book.completed) return 100;
        
        // If the book has totalPagesRead property, use it as progress
        if (book.totalPagesRead) {
            // If we don't know the total pages, just show a partial progress
            return Math.min(Math.max(book.totalPagesRead / 10, 1), 99);
        }
        
        // If the book has reading sessions, show minimal progress
        if (book.readingSessions && book.readingSessions.length > 0) {
            return 30; // Default "in progress" percentage
        }
        
        return 0; // Unread
    }
    
    // Get status label
    function getStatusLabel(book) {
        if (!book) return "Unread";
        
        if (book.completed) return "Completed";
        if (book.readingSessions && book.readingSessions.length > 0) return "In Progress";
        return "Unread";
    }
    
    // Get status color class
    function getStatusColorClass(book) {
        if (!book) return "bg-gray-100 text-gray-600";
        
        if (book.completed) return "bg-green-100 text-green-800";
        if (book.readingSessions && book.readingSessions.length > 0) return "bg-blue-100 text-blue-800";
        return "bg-gray-100 text-gray-600";
    }
    
    // Update filtered books based on search, status, and tag filters
    function updateFilteredBooks() {
        const allBooks = get(books);
        
        if (allBooks.length === 0) {
            filteredBooks.set([]);
            return;
        }
        
        // Start with all books
        let result = [...allBooks];
        
        // Apply search filter if provided
        if (searchLibraryQuery && searchLibraryQuery.trim() !== '') {
            const searchTerm = searchLibraryQuery.toLowerCase();
            result = result.filter(book => {
                if (!book) return false;
                
                return (book.title && book.title.toLowerCase().includes(searchTerm)) || 
                       (book.author && book.author.toLowerCase().includes(searchTerm));
            });
        }
        
        // Apply status filter if not "all"
        if (selectedStatusFilter !== "all") {
            result = result.filter(book => {
                if (selectedStatusFilter === "completed") return book.completed;
                if (selectedStatusFilter === "in-progress") {
                    return !book.completed && book.readingSessions && book.readingSessions.length > 0;
                }
                if (selectedStatusFilter === "unread") {
                    return !book.completed && (!book.readingSessions || book.readingSessions.length === 0);
                }
                return true;
            });
        }
        
        // Apply tag filter if not "all"
        if (selectedTagFilter !== "all") {
            result = result.filter(book => {
                return book.tags && book.tags.includes(selectedTagFilter);
            });
        }
        
        // Apply sorting
        result = sortBooks(result, sortOrder);
        
        // Update filtered books store
        filteredBooks.set(result);
    }
    
    // Sort books by different criteria
    function sortBooks(books, order) {
        const sortedBooks = [...books];
        
        switch (order) {
            case "newest":
                return sortedBooks.sort((a, b) => {
                    return new Date(b.createdAt) - new Date(a.createdAt);
                });
            case "oldest":
                return sortedBooks.sort((a, b) => {
                    return new Date(a.createdAt) - new Date(b.createdAt);
                });
            case "title-asc":
                return sortedBooks.sort((a, b) => {
                    return a.title.localeCompare(b.title);
                });
            case "title-desc":
                return sortedBooks.sort((a, b) => {
                    return b.title.localeCompare(a.title);
                });
            default:
                return sortedBooks;
        }
    }
    
    // Get filtered books with reactive rendering
    let filteredBooksCache = [];
    
    // Make sure we update filters whenever any filter parameter changes
    $: searchLibraryQuery, selectedStatusFilter, selectedTagFilter, sortOrder, viewMode, $books, updateFilteredBooks();
    
    // Update cache when filtered books change
    $: filteredBooksCache = get(filteredBooks);
    
    // Get current page items for pagination
    function getPaginatedBooks() {
        const filtered = filteredBooksCache.length > 0 ? filteredBooksCache : get(books);
        // Adjust items per page based on view mode
        const effectiveItemsPerPage = viewMode === 'list' ? 12 : 9;
        const startIndex = (currentPage - 1) * effectiveItemsPerPage;
        const endIndex = startIndex + effectiveItemsPerPage;
        return filtered.slice(startIndex, endIndex);
    }
    
    // Get total pages for pagination
    function getTotalPages() {
        const filtered = filteredBooksCache.length > 0 ? filteredBooksCache : get(books);
        // Adjust items per page based on view mode
        const effectiveItemsPerPage = viewMode === 'list' ? 12 : 9;
        return Math.ceil(filtered.length / effectiveItemsPerPage);
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
        isbn = "";
        isSearching = true;
        
        try {
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
        } catch (error) {
            console.error("Error searching:", error);
            alert("Error occurred during search. Please try again.");
        } finally {
            isSearching = false;
        }
    }
    
    // Fetch publication by DOI
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
                        isbn: fetchedData.ISBN ? fetchedData.ISBN[0] : null,
                        doi: fetchedData.DOI || null
                    }
                ];
            } else {
                searchResults = [];
            }
        } catch (error) {
            console.error("Error fetching DOI data:", error);
            alert("Failed to retrieve DOI information.");
        }
    }
    
    // Fetch publication by ISBN
    async function fetchISBN() {
        try {
            const response = await fetch(
                `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
            );
            const data = await response.json();
            if (!data[`ISBN:${isbn}`]) {
                searchResults = [];
                return;
            }
            const bookData = data[`ISBN:${isbn}`];
            
            searchResults = [
                {
                    title: bookData.title || "Unknown Title",
                    author: bookData.authors
                        ? bookData.authors.map((a) => a.name).join(", ")
                        : "Unknown Author",
                    isbn: isbn
                }
            ];
        } catch (error) {
            console.error("Error fetching ISBN data:", error);
            alert("Failed to retrieve ISBN information.");
        }
    }
    
    // Fetch publication by title
    async function fetchTitle() {
        try {
            const response = await fetch(
                `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}`
            );
            const data = await response.json();
            if (!data.docs || data.docs.length === 0) {
                searchResults = [];
                return;
            }
            searchResults = await Promise.all(
                data.docs.slice(0, 10).map(async (doc) => {
                    let isbn = doc.isbn ? doc.isbn[0] : null;
                    
                    if (!isbn && doc.key) {
                        const editionData = await fetchISBNFromEditions(doc.key);
                        isbn = editionData?.isbn || null;
                    }
                    
                    return {
                        title: doc.title || "Unknown Title",
                        author: doc.author_name ? doc.author_name.join(", ") : "Unknown Author",
                        isbn: isbn || "No ISBN"
                    };
                })
            );
        } catch (error) {
            console.error("Error fetching title data:", error);
            alert("Failed to retrieve title information.");
        }
    }
    
    // Helper function to get ISBN from editions when not available in main results
    async function fetchISBNFromEditions(workKey) {
        try {
            const response = await fetch(`https://openlibrary.org${workKey}/editions.json`);
            const data = await response.json();
            if (data.entries && data.entries.length > 0) {
                for (const entry of data.entries) {
                    let isbn = entry.isbn_10 ? entry.isbn_10[0] : entry.isbn_13 ? entry.isbn_13[0] : null;
                    if (isbn) {
                        return { isbn };
                    }
                }
            }
            return { isbn: null };
        } catch (error) {
            console.error("Error fetching ISBN from editions:", error);
            return { isbn: null };
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
                totalPagesRead: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            try {
                // Get document ID from Firestore
                const docId = await saveEntryToFirestore(newEntry);
                
                if (docId) {
                    // If we have a document ID, update the entry with it
                    newEntry.id = docId;
                    
                    // Update tags list immediately
                    const allTags = new Set(get(uniqueTags));
                    if (tags && Array.isArray(tags)) {
                        tags.forEach(tag => tag && allTags.add(tag.trim()));
                        uniqueTags.set([...allTags]);
                    }
                    
                    // Add the entry to the books store to immediately show in UI
                    books.update(currentBooks => [newEntry, ...currentBooks]);
                    
                    // Force refresh the UI
                    forceRefresh();
                    
                    // This is essential - we want to make sure it re-renders
                    setTimeout(() => {
                        updateFilteredBooks();
                        forceRefresh();
                    }, 100);
                }
                
                // Still do a full reload to ensure everything is synced properly
                // but this happens in the background
                loadUserLibrary(auth.currentUser.uid);
            } catch (error) {
                console.error("Error adding publication:", error);
                alert("Failed to add publication. Please try again.");
            }
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
            return null;
        }
        
        try {
            const userDocRef = doc(firestore, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists()) {
                await setDoc(userDocRef, { createdAt: new Date() });
            }
            
            const libraryRef = collection(userDocRef, "library");
            
            // Check if same title and author already exists - use case-insensitive comparison
            // to avoid duplicate entries that differ only in capitalization
            const allBooks = get(books);
            const titleAuthorExists = allBooks.some(book => 
                book.title?.toLowerCase() === newEntry.title?.toLowerCase() && 
                book.author?.toLowerCase() === newEntry.author?.toLowerCase()
            );
            
            if (titleAuthorExists) {
                alert("This publication is already in your library!");
                resetFields();
                return null;
            }
            
            // Check ISBN if provided - use case-insensitive comparison
            if (newEntry.isbn) {
                const isbnExists = allBooks.some(book => 
                    book.isbn && book.isbn.toLowerCase() === newEntry.isbn.toLowerCase()
                );
                
                if (isbnExists) {
                    alert("This ISBN is already in your library!");
                    resetFields();
                    return null;
                }
            }
            
            // Add document and get the document reference
            const docRef = await addDoc(libraryRef, {
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
            
            resetFields();
            modalOpen = false;
            
            // Force UI to update immediately - we do this directly instead of waiting
            books.update(currentBooks => {
                // Create a completely new array to force reactivity
                const updatedEntry = {
                    id: docRef.id,
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
                };
                return [updatedEntry, ...currentBooks];
            });
            
            // Update filtered books directly too
            filteredBooks.update(filtered => {
                if (filtered.length === 0) {
                    return get(books);
                } else {
                    return [...filtered]; 
                }
            });
            
            // Force refresh multiple times
            forceRefresh();
            setTimeout(() => forceRefresh(), 100);
            setTimeout(() => forceRefresh(), 500);
            return docRef.id; // Return the document ID so we can use it
        } catch (error) {
            console.error("Error saving entry:", error);
            alert("Failed to add publication. Please try again.");
            return null;
        }
    }
    
    async function deletePublication(publicationId) {
        if (!publicationId) return;
        
        // Confirm deletion with user
        if (!confirm("Are you sure you want to delete this publication? This action cannot be undone.")) {
            return;
        }
        
        const user = auth.currentUser;
        if (!user) {
            console.error("No authenticated user found.");
            return;
        }
        
        try {
            const userDocRef = doc(firestore, "users", user.uid);
            const publicationDocRef = doc(collection(userDocRef, "library"), publicationId);
            
            // Delete from Firestore
            await deleteDoc(publicationDocRef);
            
            // Update local state by removing the deleted publication
            books.update(currentBooks => 
                currentBooks.filter(book => book.id !== publicationId)
            );
            
            // Also update filtered books if necessary
            filteredBooks.update(filtered => 
                filtered.filter(book => book.id !== publicationId)
            );
            
            // Force refresh the UI
            forceRefresh();
            
            // If viewing the deleted publication, close the modal
            if (viewingPublication && viewingPublication.id === publicationId) {
                viewModalOpen = false;
            }
            
            console.log(`Publication ${publicationId} successfully deleted.`);
        } catch (error) {
            console.error("Error deleting publication:", error.message);
            alert("Failed to delete publication. Please try again.");
        }
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
    
    // Navigation functions
    function goToFirstPage() {
        currentPage = 1;
    }
    
    function goToLastPage() {
        currentPage = getTotalPages();
    }
    
    function goToNextPage() {
        if (currentPage < getTotalPages()) {
            currentPage++;
        }
    }
    
    function goToPrevPage() {
        if (currentPage > 1) {
            currentPage--;
        }
    }
    
    // Reset filters
    function resetFilters() {
        searchLibraryQuery = "";
        selectedStatusFilter = "all";
        selectedTagFilter = "all";
        sortOrder = "newest"; // Reset to default sort as well
        currentPage = 1; // Reset to first page
        // The reactive statement will automatically trigger updateFilteredBooks
    }
    
    // Toggle view mode between grid and list
    function toggleViewMode(mode) {
        // Only change if mode is different
        if (viewMode !== mode) {
            viewMode = mode;
            localStorage.setItem("library-view-mode", mode);
            // Reset to first page when switching views to avoid empty pages
            currentPage = 1;
        }
    }
    
    // Format date for display
    function formatDate(dateStr) {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        return date.toLocaleDateString();
    }
    
    // Initialize with proper auth state handling
    onMount(() => {
        isLoading = true;
        
        // Load view mode preference from localStorage or default to grid
        viewMode = localStorage.getItem("library-view-mode") || "grid";
        
        // Use Firebase's auth state listener instead of checking currentUser directly
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            try {
                if (user) {
                    await Promise.all([
                        fetchUserData(user.uid),
                        loadUserLibrary(user.uid)
                    ]);
                } else {
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

        <!-- Main Content Area -->
        <div class="flex-1 bg-gray-50 pt-8 pb-12 px-6 md:px-12">
            <!-- Library Card Container -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <!-- Header Section -->
                <div class="p-6 border-b border-gray-100">
                    <h2 class="text-2xl font-bold text-gray-800 mb-6">My Publications</h2>
                    
                    <!-- Search and Filter Controls -->
                    <div class="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                        <!-- Search Bar -->
                        <div class="relative w-full md:w-1/2">
                            <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <Input 
                                type="text" 
                                placeholder="Search by title or author..." 
                                class="pl-10 w-full"
                                bind:value={searchLibraryQuery}
                                on:input={updateFilteredBooks}
                            />
                        </div>
                        
                        <!-- Filter Controls -->
                        <div class="flex flex-wrap gap-3 items-center w-full md:w-auto">
                            <!-- View Toggle -->
                            <div class="flex rounded-md overflow-hidden border border-gray-200">
                                <button 
                                    class={`flex items-center gap-1 px-3 py-1.5 text-sm ${viewMode === 'grid' ? 'bg-blue-50 text-blue-700 font-medium' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                    on:click={() => toggleViewMode('grid')}
                                >
                                    <LayoutGrid class="h-4 w-4" />
                                    <span class="md:inline hidden">Grid</span>
                                </button>
                                <button 
                                    class={`flex items-center gap-1 px-3 py-1.5 text-sm ${viewMode === 'list' ? 'bg-blue-50 text-blue-700 font-medium' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                    on:click={() => toggleViewMode('list')}
                                >
                                    <List class="h-4 w-4" />
                                    <span class="md:inline hidden">List</span>
                                </button>
                            </div>

                            <!-- Status Filter -->
                            <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                    <Button variant="outline" class={`flex items-center gap-2 ${selectedStatusFilter !== 'all' ? 'bg-blue-50 border-blue-200' : ''}`}>
                                        <Filter class="h-4 w-4" />
                                        <span>
                                            {selectedStatusFilter === 'all' ? 'Status' : 
                                             selectedStatusFilter === 'unread' ? 'Unread' :
                                             selectedStatusFilter === 'in-progress' ? 'In Progress' : 'Completed'}
                                        </span>
                                        <ChevronDown class="h-4 w-4" />
                                    </Button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Content>
                                    <DropdownMenu.Item on:click={() => {selectedStatusFilter = "all";}}>
                                        <span>All Statuses</span>
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item on:click={() => {selectedStatusFilter = "unread";}}>
                                        <span>Unread</span>
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item on:click={() => {selectedStatusFilter = "in-progress";}}>
                                        <span>In Progress</span>
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item on:click={() => {selectedStatusFilter = "completed";}}>
                                        <span>Completed</span>
                                    </DropdownMenu.Item>
                                </DropdownMenu.Content>
                            </DropdownMenu.Root>
                            
                            <!-- Tags Filter -->
                            <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                    <Button variant="outline" class={`flex items-center gap-2 ${selectedTagFilter !== 'all' ? 'bg-blue-50 border-blue-200' : ''}`}>
                                        <Tag class="h-4 w-4" />
                                        <span>
                                            {selectedTagFilter === 'all' ? 'Tags' : selectedTagFilter}
                                        </span>
                                        <ChevronDown class="h-4 w-4" />
                                    </Button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Content>
                                    <DropdownMenu.Item on:click={() => {selectedTagFilter = "all";}}>
                                        <span>All Tags</span>
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Separator />
                                    {#each $uniqueTags as tag}
                                        <DropdownMenu.Item on:click={() => {selectedTagFilter = tag;}}>
                                            <span>{tag}</span>
                                        </DropdownMenu.Item>
                                    {/each}
                                </DropdownMenu.Content>
                            </DropdownMenu.Root>
                            
                            <!-- Sort Control -->
                            <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                    <Button variant="outline" class="flex items-center gap-2">
                                        <ArrowUpDown class="h-4 w-4" />
                                        <span>
                                            {sortOrder === 'newest' ? 'Newest First' : 
                                             sortOrder === 'oldest' ? 'Oldest First' :
                                             sortOrder === 'title-asc' ? 'Title (A-Z)' : 
                                             sortOrder === 'title-desc' ? 'Title (Z-A)' : 'Sort'}
                                        </span>
                                        <ChevronDown class="h-4 w-4" />
                                    </Button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Content>
                                    <DropdownMenu.Item on:click={() => {sortOrder = "newest";}}>
                                        <span>Newest First</span>
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item on:click={() => {sortOrder = "oldest";}}>
                                        <span>Oldest First</span>
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item on:click={() => {sortOrder = "title-asc";}}>
                                        <span>Title (A-Z)</span>
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item on:click={() => {sortOrder = "title-desc";}}>
                                        <span>Title (Z-A)</span>
                                    </DropdownMenu.Item>
                                </DropdownMenu.Content>
                            </DropdownMenu.Root>
                            
                            <!-- Reset Filters -->
                            {#if searchLibraryQuery || selectedStatusFilter !== "all" || selectedTagFilter !== "all"}
                                <Button variant="ghost" class="text-xs" on:click={resetFilters}>
                                    <X class="h-3 w-3 mr-1" />
                                    Reset
                                </Button>
                            {/if}
                        </div>
                    </div>
                </div>
                
                <!-- Publications Display - Grid or List View -->
                <div class="p-6">
                    {#key [$refreshCounter, viewMode]}
                        {#if getPaginatedBooks().length > 0}
                            {#if viewMode === 'grid'}
                                <!-- Display as Grid of Cards -->
                                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {#each getPaginatedBooks() as book}
                                        <div 
                                            class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden h-64 flex flex-col relative cursor-pointer hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                                            on:click={() => openViewModal(book)}
                                            on:keydown={e => e.key === 'Enter' && openViewModal(book)}
                                            tabindex="0"
                                            role="button"
                                            aria-label={`View details for ${book.title}`}>
                                            <!-- Card Header with Menu -->
                                            <div class="absolute top-3 right-3 z-10" on:click|stopPropagation on:keydown|stopPropagation role="presentation">
                                                <DropdownMenu.Root>
                                                    <DropdownMenu.Trigger asChild>
                                                        <button class="text-gray-400 hover:text-gray-600 p-1 bg-white rounded-full shadow-sm">
                                                            <Ellipsis class="h-4 w-4" />
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
                                            
                                            <!-- Card Content -->
                                            <div class="p-4 flex-1 flex flex-col">
                                                <!-- Status Badge -->
                                                <div class="mb-3">
                                                    <span class={`inline-block px-2 py-0.5 text-xs rounded-full ${
                                                        book.completed ? "bg-green-100 text-green-800" : 
                                                        book.readingSessions?.length > 0 ? "bg-blue-100 text-blue-800" : 
                                                        "bg-gray-100 text-gray-800"
                                                    }`}>
                                                        {getStatusLabel(book)}
                                                    </span>
                                                </div>
                                                
                                                <!-- Title and Author -->
                                                <div class="flex-1">
                                                    <h3 class="text-lg font-semibold line-clamp-2 hover:text-blue-600">
                                                        {book.title}
                                                    </h3>
                                                    <p class="text-sm text-gray-600 mt-1 line-clamp-1">{book.author}</p>
                                                    
                                                    <!-- Tags -->
                                                    <div class="mt-2 min-h-[1.5rem]">
                                                        {#if book.tags && book.tags.length > 0}
                                                            <div class="flex flex-wrap gap-1.5">
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
                                                </div>
                                                
                                                <!-- Pages Read Footer -->
                                                <div class="mt-4 pt-3 border-t border-gray-100">
                                                    <div class="text-sm text-gray-600">
                                                        {book.totalPagesRead || 0} pages read
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {:else}
                                <!-- Display as List -->
                                <div class="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                    {#each getPaginatedBooks() as book, index}
                                        <div 
                                            class="relative hover:bg-gray-50 transition-colors cursor-pointer focus:outline-none focus:bg-blue-50" 
                                            on:click={() => openViewModal(book)}
                                            on:keydown={e => e.key === 'Enter' && openViewModal(book)}
                                            tabindex="0"
                                            role="button"
                                            aria-label={`View details for ${book.title}`}>
                                            {#if index > 0}
                                                <div class="absolute left-0 right-0 top-0 h-px bg-gray-100"></div>
                                            {/if}
                                            <div class="p-4">
                                                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                    <div class="flex-1">
                                                        <!-- Title Row with Status Badge -->
                                                        <div class="flex items-center gap-2 mb-1.5">
                                                            <h3 class="text-lg font-semibold text-gray-900 line-clamp-1 hover:text-blue-600">
                                                                {book.title}
                                                            </h3>
                                                            <span class={`inline-block px-2 py-0.5 text-xs rounded-full ${
                                                                book.completed ? "bg-green-100 text-green-800" : 
                                                                book.readingSessions?.length > 0 ? "bg-blue-100 text-blue-800" : 
                                                                "bg-gray-100 text-gray-800"
                                                            }`}>
                                                                {getStatusLabel(book)}
                                                            </span>
                                                        </div>
                                                        
                                                        <!-- Author -->
                                                        <p class="text-sm text-gray-600">{book.author}</p>
                                                        
                                                        <!-- Tags -->
                                                        <div class="mt-2 min-h-[1.5rem]">
                                                            {#if book.tags && book.tags.length > 0}
                                                                <div class="flex flex-wrap gap-1.5">
                                                                    {#each book.tags as tag}
                                                                        <span class="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-800 rounded-full">
                                                                            {tag}
                                                                        </span>
                                                                    {/each}
                                                                </div>
                                                            {/if}
                                                        </div>
                                                    </div>
                                                    
                                                    <!-- Right Side: Pages and Menu -->
                                                    <div class="flex items-center gap-4 self-start sm:self-center ml-auto">
                                                        <div class="text-sm font-medium text-gray-600 whitespace-nowrap">
                                                            {book.totalPagesRead || 0} pages read
                                                        </div>
                                                        
                                                        <!-- Menu -->
                                                        <div class="flex-shrink-0" on:click|stopPropagation on:keydown|stopPropagation role="presentation">
                                                            <DropdownMenu.Root>
                                                                <DropdownMenu.Trigger asChild>
                                                                    <button class="text-gray-400 hover:text-gray-600 p-1 bg-white rounded-full shadow-sm">
                                                                        <Ellipsis class="h-4 w-4" />
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
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                            
                            <!-- Pagination Controls -->
                            {#if getTotalPages() > 1}
                                <div class="flex justify-center mt-8 gap-2">
                                    <Button variant="outline" size="sm" on:click={goToFirstPage} disabled={currentPage === 1}>
                                        First
                                    </Button>
                                    <Button variant="outline" size="sm" on:click={goToPrevPage} disabled={currentPage === 1}>
                                        Previous
                                    </Button>
                                    <span class="px-4 py-2 bg-gray-100 rounded-md text-sm">
                                        Page {currentPage} of {getTotalPages()}
                                    </span>
                                    <Button variant="outline" size="sm" on:click={goToNextPage} disabled={currentPage === getTotalPages()}>
                                        Next
                                    </Button>
                                    <Button variant="outline" size="sm" on:click={goToLastPage} disabled={currentPage === getTotalPages()}>
                                        Last
                                    </Button>
                                </div>
                            {/if}
                        {:else}
                            <!-- Empty State -->
                            <div class="flex flex-col items-center justify-center py-12 text-center">
                                <div class="size-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                                    <Book class="h-8 w-8 text-blue-500" />
                                </div>
                                <h3 class="text-lg font-medium text-gray-800">No publications found</h3>
                                
                                {#if searchLibraryQuery || selectedStatusFilter !== "all" || selectedTagFilter !== "all"}
                                    <p class="text-sm text-gray-500 mt-2 max-w-md">
                                        No publications match your current filters. Try adjusting your search criteria or reset filters.
                                    </p>
                                    <Button class="mt-4" variant="outline" on:click={resetFilters}>
                                        <X class="h-4 w-4 mr-2" /> Reset Filters
                                    </Button>
                                {:else}
                                    <p class="text-sm text-gray-500 mt-2 max-w-md">
                                        Your library is empty. Add your first publication to get started.
                                    </p>
                                    <Button class="mt-4 bg-blue-600 hover:bg-blue-700 text-white" on:click={openAddModal}>
                                        <Plus class="h-4 w-4 mr-2" /> Add Publication
                                    </Button>
                                {/if}
                            </div>
                        {/if}
                    {/key}
                </div>
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
                  <li class="p-3 hover:bg-neutral-100 cursor-pointer" on:click={() => selectResult(result)} on:keydown={e => e.key === 'Enter' && selectResult(result)} tabindex="0" role="button">
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