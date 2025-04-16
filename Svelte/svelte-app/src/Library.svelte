<script>
    import { auth, firestore } from "./firebase";
    import { doc, collection, getDocs, getDoc, addDoc, updateDoc, setDoc, deleteDoc, query, where, writeBatch } from "firebase/firestore";
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
        List,
        Home,
        BookText,
        BarChart,
        Star
    } from "lucide-svelte";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import * as Dialog from "$lib/components/ui/dialog";
    import * as Popover from "$lib/components/ui/popover";
    import { Button } from "$lib/components/ui/button";
    import { Separator } from "$lib/components/ui/separator";
    import { Progress } from "$lib/components/ui/progress";
    import { Input } from "$lib/components/ui/input";
    import { navigate } from "svelte-routing";
    import { toast } from "$lib/components/ui/sonner";

    // State
    let isLoading = true;
    let firstName = "User";
    let lastName = "";
    let currentPage = 1;
    let itemsPerPage = 9; // Default for grid view
    
    // Initialize writable stores
    const books = writable([]);
    const uniqueTags = writable([]);
    const uniqueAuthors = writable([]);
    const filteredBooks = writable([]);
    
    // Search and filter states
    let searchLibraryQuery = "";
    let selectedStatusFilter = "all";
    let selectedTagFilter = "all";
    let selectedAuthorFilter = "all";
    let selectedRatingFilter = "all"; // Options: all, 1, 2, 3, 4, 5
    let sortOrder = "newest"; // Options: newest, oldest, title-asc, title-desc
    
    // View mode state
    let viewMode = localStorage.getItem("library-view-mode") || "grid"; // Options: grid, list
    
    // Create a reactive count to force re-rendering
    const refreshCounter = writable(0);
    
    // Used to trigger chart refresh
    const chartKey = writable(0);
    
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
            // Extract authors
            const allAuthors = new Set();
            loadedBooks.forEach(book => {
                if (book.tags && Array.isArray(book.tags)) {
                    book.tags.forEach(tag => allTags.add(tag));
                }
                if (book.author) {
                    allAuthors.add(book.author);
                }
            });
            uniqueTags.set([...allTags]);
            uniqueAuthors.set([...allAuthors]);
            
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
            console.log("No books in library, setting empty filtered books");
            filteredBooks.set([]);
            return;
        }
        
        // Log book data to inspect structure
        console.log("Books data sample:", allBooks.slice(0, 2).map(book => ({
            id: book.id,
            title: book.title,
            author: book.author,
            rating: book.rating,
            tags: book.tags
        })));
        
        console.log(`Filtering ${allBooks.length} books with criteria:`, {
            searchQuery: searchLibraryQuery,
            status: selectedStatusFilter,
            tag: selectedTagFilter,
            author: selectedAuthorFilter,
            rating: selectedRatingFilter,
            sort: sortOrder
        });
        
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
            console.log(`Filtered to ${result.length} books using search term: "${searchTerm}"`);
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
        
        // Apply author filter if not "all"
        if (selectedAuthorFilter !== "all") {
            const authorCount = result.length;
            result = result.filter(book => {
                return book.author && book.author.toLowerCase() === selectedAuthorFilter.toLowerCase();
            });
            console.log(`Author filter applied (${selectedAuthorFilter}): ${authorCount} → ${result.length} books`);
        }
        
        // Apply rating filter if not "all"
        if (selectedRatingFilter !== "all") {
            const ratingCount = result.length;
            const ratingValue = parseInt(selectedRatingFilter);
            result = result.filter(book => {
                // Handle cases where rating might be stored as string or number
                const bookRating = typeof book.rating === 'string' ? parseInt(book.rating) : book.rating;
                return bookRating === ratingValue;
            });
            console.log(`Rating filter applied (${ratingValue}): ${ratingCount} → ${result.length} books`);
        }
        
        // Apply sorting
        result = sortBooks(result, sortOrder);
        
        // Reset to first page when filtering changes results
        currentPage = 1;
        
        // Update filtered books store
        console.log(`Setting filtered books to ${result.length} items`);
        filteredBooks.set(result);
        
        // Force cache update
        filteredBooksCache = result;
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
    $: {
        searchLibraryQuery;
        selectedStatusFilter;
        selectedTagFilter;
        selectedAuthorFilter;
        selectedRatingFilter;
        sortOrder;
        console.log("Filter changed: ", { 
            searchLibraryQuery, 
            selectedStatusFilter, 
            selectedTagFilter,
            selectedAuthorFilter,
            selectedRatingFilter, 
            sortOrder 
        });
        updateFilteredBooks();
    }
    
    // Update cache when filtered books change, ensuring reactivity
    $: {
        const filtered = get(filteredBooks);
        filteredBooksCache = filtered;
        console.log(`Updated filteredBooksCache with ${filteredBooksCache.length} books`);
    }
    
    // Get current page items for pagination
    function getPaginatedBooks() {
        // Always get fresh data from the store
        const filtered = get(filteredBooks);
        const allBooks = get(books);
        
        console.log(`Getting paginated books: ${filtered.length} filtered books, ${allBooks.length} total books available`);
        
        // If we have no filtered books but have books in the library, likely the filter is too restrictive
        // or there was an error in filtering
        if (filtered.length === 0 && allBooks.length > 0) {
            // Only show no results if filters are actually applied
            if (searchLibraryQuery || selectedStatusFilter !== "all" || selectedTagFilter !== "all" || selectedAuthorFilter !== "all" || selectedRatingFilter !== "all") {
                console.log("Filters applied but no books match, showing empty results");
                return [];
            }
            
            // If no filters are applied but we still have no filtered books, use all books
            console.log("No filters applied, showing all books");
            // Re-run update to be safe
            updateFilteredBooks();
            // Get the updated filtered books
            const updatedFiltered = get(filteredBooks);
            if (updatedFiltered.length > 0) {
                // Pagination logic for updatedFiltered
                const effectiveItemsPerPage = viewMode === 'list' ? 12 : 9;
                const startIndex = (currentPage - 1) * effectiveItemsPerPage;
                const endIndex = startIndex + effectiveItemsPerPage;
                const result = updatedFiltered.slice(startIndex, endIndex);
                console.log(`Displaying ${result.length} books from updated filter for page ${currentPage}`);
                return result;
            }
            
            // If still no filtered books, use all books directly
            const effectiveItemsPerPage = viewMode === 'list' ? 12 : 9;
            const startIndex = (currentPage - 1) * effectiveItemsPerPage;
            const endIndex = startIndex + effectiveItemsPerPage;
            const result = allBooks.slice(startIndex, endIndex);
            console.log(`Displaying ${result.length} books directly from allBooks for page ${currentPage}`);
            return result;
        }
        
        // Adjust items per page based on view mode
        const effectiveItemsPerPage = viewMode === 'list' ? 12 : 9;
        const startIndex = (currentPage - 1) * effectiveItemsPerPage;
        const endIndex = startIndex + effectiveItemsPerPage;
        
        const result = filtered.slice(startIndex, endIndex);
        console.log(`Displaying ${result.length} books for page ${currentPage}`);
        return result;
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
        console.log("Opening view modal for book:", book.title);
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
            
            // Use batch for atomic operations
            const batch = writeBatch(firestore);
            
            let readingSessions = [];
            let streak = 0;
            let streakDate = null;
            // Set time to midnight for proper day comparison
            let today = new Date();
            today.setHours(0, 0, 0, 0);
            let todayString = today.toISOString().split("T")[0]; // Get current date (YYYY-MM-DD)
            let readingLog = [];
            
            if (!entryDocSnap.exists()) {
                console.error("Publication not found for progress update.");
                return;
            }
            
            const entryData = entryDocSnap.data();
            readingSessions = entryData.readingSessions || [];
            
            if (summaryDocSnap.exists()) {
                const summaryData = summaryDocSnap.data();
                streak = summaryData.streak || 0;
                streakDate = summaryData.streakDate || null;
                readingLog = summaryData.readingLog || [];
            }
            
            // Create reading session entry with timestamp
            const timestamp = new Date();
            const sessionEntry = {
                dateTitle: timestamp.toLocaleDateString(),
                pagesRead: pagesRead,
                notes: comment || "",
                duration: duration,
                date: timestamp.toISOString()
            };
            
            readingSessions.push(sessionEntry);
            
            // Streak Logic - Use midnight-to-midnight comparison
            if (!streakDate) {
                // First reading ever - start streak at 1
                streak = 1;
                streakDate = todayString;
            } else {
                // Check if the streak date is the same as today
                if (streakDate === todayString) {
                    // Reading logged multiple times on the same day - keep streak unchanged
                    console.log("Same day reading - streak unchanged:", streak);
                    // streakDate remains unchanged
                } 
                else {
                    // Different day - calculate days between
                    const lastLogDate = new Date(streakDate);
                    lastLogDate.setHours(0, 0, 0, 0); // Reset time to midnight for proper comparison
                    
                    // Calculate difference in days based on calendar days (midnight to midnight)
                    const timeDiff = Math.round((today - lastLogDate) / (1000 * 60 * 60 * 24));
                    console.log(`Day difference between readings: ${timeDiff} days`);

                    if (timeDiff === 1) {
                        // Reading on consecutive days - increment streak
                        streak += 1;
                        console.log(`Consecutive day reading - streak increased to ${streak}`);
                        streakDate = todayString;
                    } else if (timeDiff > 1) {
                        // Gap in reading days - reset streak
                        streak = 1;
                        console.log(`Gap in reading (${timeDiff} days) - streak reset to 1`);
                        streakDate = todayString;
                    }
                    // Any other cases shouldn't happen but we'll leave the streak as is
                }
            }
            
            // Update Reading Log (for Timeline Chart)
            let updatedLog = readingLog.map(log => ({ ...log })); // Clone array to avoid mutation
            
            // Check if today already exists in log, update instead of adding duplicate
            let todayLogIndex = updatedLog.findIndex(log => {
                if (typeof log.date === 'string') {
                    return log.date === todayString;
                } else if (log.date instanceof Date) {
                    return log.date.toISOString().split('T')[0] === todayString;
                } else {
                    // For any other format (like Firestore Timestamp)
                    try {
                        const logDate = new Date(log.date.toDate ? log.date.toDate() : log.date);
                        return logDate.toISOString().split('T')[0] === todayString;
                    } catch (e) {
                        console.warn("Invalid date format in reading log:", log.date);
                        return false;
                    }
                }
            });
            
            if (todayLogIndex !== -1) {
                updatedLog[todayLogIndex].pagesRead += pagesRead; // Aggregate pages read for today
            } else {
                updatedLog.unshift({ date: todayString, pagesRead }); // Add new entry for today
            }
            
            // Ensure we only keep logs within 90 days
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 90);
            cutoffDate.setHours(0, 0, 0, 0);
            
            // Remove outdated logs
            updatedLog = updatedLog.filter(log => {
                try {
                    const logDate = typeof log.date === 'string' ? new Date(log.date) : 
                                    log.date instanceof Date ? log.date :
                                    log.date.toDate ? log.date.toDate() : new Date(log.date);
                    return logDate >= cutoffDate;
                } catch (e) {
                    console.warn("Error filtering log date:", e);
                    return false;
                }
            });
            
            console.log(`Removed logs older than 90 days. Remaining logs: ${updatedLog.length}`);
            
            // Update publication status if not already marked as complete
            let status = entryData.status || "unread";
            if (status === "unread" && !entryData.completed) {
                status = "in progress";
            }
            
            // Update publication with batch
            batch.update(entryDocRef, {
                readingSessions: readingSessions,
                updatedAt: timestamp,
                lastAccessed: timestamp,
                totalPagesRead: (entryData.totalPagesRead || 0) + pagesRead,
                status: status
            });
            
            // Update summary with batch
            batch.set(summaryDocRef, {
                mostRecent: entryData.title,
                updatedAt: timestamp,
                streak: streak,
                streakDate: streakDate, // This is the ISO date string (YYYY-MM-DD)
                readingLog: updatedLog
            }, { merge: true });
            
            console.log(`✅ Streak updated: ${streak} days, streakDate: ${streakDate}`);
            
            // Commit both updates atomically
            await batch.commit();
            
            console.log(`✅ Updated streak to ${streak} days, streakDate: ${streakDate}`);
            console.log(`✅ Updated reading log with ${updatedLog.length} entries`);
            
            // Ensure UI updates properly
            if (viewingPublication && viewingPublication.id === entryId) {
                viewingPublication.readingSessions = readingSessions;
                viewingPublication.totalPagesRead = (viewingPublication.totalPagesRead || 0) + pagesRead;
                viewingPublication.status = status;
            }
            
            // Reload library data to update UI
            await loadUserLibrary(user.uid);
            
            // Force UI refresh
            forceRefresh();
            
        } catch (error) {
            console.error("❌ Error updating progress:", error.message);
            alert("Failed to update reading progress. Please try again.");
        }
    }
    
    function logout() {
        signOut(auth).then(() => {
            navigate("/login");
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
            // More flexible DOI pattern
            if (/^10\.\d{2,}\/.*$/.test(searchQuery.trim())) {
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
            console.error("Error during search:", error);
            alert("An error occurred during search. Please try again.");
        } finally {
            isSearching = false; // Always reset searching state
        }
    }
    
    // Fetch publication by DOI
    async function fetchDOI() {
        try {
            // Use HTTPS for all requests and clean the DOI first
            const cleanDOI = searchQuery.trim();
            console.log("Fetching DOI with cleaned value:", cleanDOI);
            
            // Use CrossRef API with proper error handling
            const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDOI)}`);
            
            // Check if the response is ok before parsing JSON
            if (!response.ok) {
                console.error("CrossRef API error:", response.status, response.statusText);
                throw new Error(`CrossRef API returned ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log("CrossRef response:", data);
            
            if (data.status === "ok" && data.message) {
                const fetchedData = data.message;
                
                // Format authors properly
                let authorString = "Unknown Author";
                if (fetchedData.author && Array.isArray(fetchedData.author) && fetchedData.author.length > 0) {
                    authorString = fetchedData.author
                        .map(a => {
                            // Handle different author formats
                            if (a.given && a.family) {
                                return `${a.given} ${a.family}`;
                            } else if (a.name) {
                                return a.name;
                            } else {
                                return a.family || a.given || "";
                            }
                        })
                        .filter(name => name) // Remove any empty names
                        .join(", ");
                }
                
                searchResults = [
                    {
                        title: fetchedData.title ? fetchedData.title[0] : "Unknown Title",
                        author: authorString,
                        isbn: fetchedData.ISBN ? fetchedData.ISBN[0] : null,
                        doi: fetchedData.DOI || cleanDOI // Use the DOI from the response or fall back to the query
                    }
                ];
                
                console.log("Formatted DOI search result:", searchResults);
            } else {
                console.warn("No valid data found in CrossRef response");
                searchResults = [];
            }
        } catch (error) {
            console.error("Error fetching DOI data:", error);
            // More user-friendly error message
            alert(`DOI lookup failed: ${error.message || "Unknown error"}. Please verify your DOI is correct.`);
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
                
                // Add success toast
                toast.success(`Added "${title}" to your library`);
            } catch (error) {
                console.error("Error adding publication:", error.message);
                toast.error(`Failed to add publication: ${error.message}`);
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
            
            // Add success toast
            toast.success(`Updated "${title}" successfully`);
            
        } catch (error) {
            console.error("Error updating publication:", error.message);
            toast.error(`Failed to update publication: ${error.message}`);
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
            const entryDocRef = doc(userDocRef, "library", publicationId);
            const summaryDocRef = doc(collection(userDocRef, "charts"), "summary");
            const ratingsDocRef = doc(collection(userDocRef, "charts"), "ratings");
            const tagsDocRef = doc(collection(userDocRef, "charts"), "tags");
            const authorsDocRef = doc(collection(userDocRef, "charts"), "authors");
            
            // Fetch publication before deletion
            const entryDocSnap = await getDoc(entryDocRef);
            if (!entryDocSnap.exists()) {
                console.warn("Publication not found.");
                return;
            }
            
            const deletedPub = entryDocSnap.data();
            const deletedTitle = deletedPub.title;
            const deletedAuthor = deletedPub.author;
            const deletedTags = deletedPub.tags || [];
            const deletedRating = deletedPub.rating;
            
            // Create a batch for atomic operations
            const batch = writeBatch(firestore);
            
            // Update UI first for better UX
            books.update(currentBooks => currentBooks.filter(book => book.id !== publicationId));
            filteredBooks.update(filtered => filtered.filter(book => book.id !== publicationId));
            
            // 1. Delete the publication
            batch.delete(entryDocRef);
            
            // 2. Update ratings counts if publication had a rating
            if (deletedRating) {
                const ratingsSnap = await getDoc(ratingsDocRef);
                if (ratingsSnap.exists()) {
                    const ratingsData = ratingsSnap.data();
                    if (ratingsData[deletedRating]) {
                        ratingsData[deletedRating] = Math.max(0, ratingsData[deletedRating] - 1);
                        if (ratingsData[deletedRating] === 0) {
                            delete ratingsData[deletedRating];
                        }
                        batch.set(ratingsDocRef, ratingsData, { merge: false });
                    }
                }
            }
            
            // 3. Update author counts
            if (deletedAuthor) {
                const authorsSnap = await getDoc(authorsDocRef);
                if (authorsSnap.exists()) {
                    const authorsData = authorsSnap.data();
                    if (authorsData[deletedAuthor]) {
                        authorsData[deletedAuthor] = Math.max(0, authorsData[deletedAuthor] - 1);
                        if (authorsData[deletedAuthor] === 0) {
                            delete authorsData[deletedAuthor];
                        }
                        batch.set(authorsDocRef, authorsData, { merge: false });
                    }
                }
            }
            
            // 4. Update tags counts
            if (deletedTags.length > 0) {
                const tagsSnap = await getDoc(tagsDocRef);
                if (tagsSnap.exists()) {
                    const tagsData = tagsSnap.data();
                    deletedTags.forEach(tag => {
                        if (tagsData[tag]) {
                            tagsData[tag] = Math.max(0, tagsData[tag] - 1);
                            if (tagsData[tag] === 0) {
                                delete tagsData[tag];
                            }
                        }
                    });
                    batch.set(tagsDocRef, tagsData, { merge: false });
                }
            }
            
            // 5. Check if it was the most recent book and update summary
            const summarySnap = await getDoc(summaryDocRef);
            if (summarySnap.exists()) {
                const summaryData = summarySnap.data();
                
                if (summaryData.mostRecent === deletedTitle) {
                    // Find new most recent book
                    const libraryRef = collection(userDocRef, "library");
                    const q = query(libraryRef, orderBy("updatedAt", "desc"), limit(1));
                    const querySnapshot = await getDocs(q);
                    
                    if (!querySnapshot.empty) {
                        const newMostRecent = querySnapshot.docs[0].data().title;
                        batch.update(summaryDocRef, { 
                            mostRecent: newMostRecent,
                            updatedAt: new Date()
                        });
                    } else {
                        batch.update(summaryDocRef, { 
                            mostRecent: null,
                            updatedAt: new Date()
                        });
                    }
                }
            }
            
            // Commit all changes atomically
            await batch.commit();
            console.log(`✅ Deleted publication: ${deletedTitle} and updated all related data`);
            
            // Force refresh the UI
            forceRefresh();
            
            // If viewing the deleted publication, close the modal
            if (viewingPublication && viewingPublication.id === publicationId) {
                viewModalOpen = false;
            }
            
            // Add success toast
            toast.success(`Deleted "${deletedTitle}" successfully`);
            
        } catch (error) {
            console.error("❌ Error deleting publication:", error.message);
            alert("Failed to delete publication. Please try again.");
            toast.error(`Failed to delete publication: ${error.message}`);
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
        if (!publicationToRate || currentRating === 0) return;
        
        const user = auth.currentUser;
        if (!user) {
            console.error("No authenticated user found.");
            return;
        }
        
        try {
            const userDocRef = doc(firestore, "users", user.uid);
            const libraryRef = doc(userDocRef, "library", publicationToRate);
            const ratingsDocRef = doc(userDocRef, "charts", "ratings");
            
            // Fetch existing data
            const librarySnap = await getDoc(libraryRef);
            const ratingsSnap = await getDoc(ratingsDocRef);
            let ratingsData = ratingsSnap.exists() ? ratingsSnap.data() : {};
            
            // Remove previous rating (if exists)
            if (librarySnap.exists()) {
                const prevRating = librarySnap.data().rating;
                if (prevRating && ratingsData[prevRating]) {
                    ratingsData[prevRating] = Math.max(0, ratingsData[prevRating] - 1);
                    if (ratingsData[prevRating] === 0) {
                        delete ratingsData[prevRating];
                    }
                }
            }
            
            // Use batch for atomicity
            const batch = writeBatch(firestore);
            
            // Update publication rating
            batch.update(libraryRef, {
                rating: currentRating,
                updatedAt: new Date()
            });
            
            // Update overall ratings count in the charts/ratings document
            // Ensure the new rating is properly incremented
            ratingsData[currentRating.toString()] = (ratingsData[currentRating.toString()] || 0) + 1;
            
            // Now set the entire ratings data object
            batch.set(ratingsDocRef, ratingsData, { merge: false });
            
            // Commit all changes at once
            await batch.commit();
            
            console.log(`✅ Rating of ${currentRating} saved for publication ${publicationToRate}`);
            
            // Update UI
            books.update(currentBooks => 
                currentBooks.map(book => 
                    book.id === publicationToRate ? 
                    { ...book, rating: currentRating } : 
                    book
                )
            );
            
            ratingDialogOpen = false;
            
            // Refresh UI
            forceRefresh();
            
            // Trigger charts to refresh
            chartKey.update(n => n + 1);
        } catch (error) {
            console.error("❌ Error saving rating:", error.message);
            alert("Failed to save rating. Please try again.");
        }
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
        console.log("Resetting all filters");
        // Clear all filter values
        searchLibraryQuery = "";
        selectedStatusFilter = "all";
        selectedTagFilter = "all";
        selectedAuthorFilter = "all";
        selectedRatingFilter = "all";
        sortOrder = "newest"; // Reset to default sort as well
        currentPage = 1; // Reset to first page
        
        // Manually ensure the UI reflects the state changes
        setTimeout(() => {
            // Force update filtered books with new criteria
            updateFilteredBooks();
            
            // Force multiple UI refreshes to ensure all components update
            forceRefresh();
            setTimeout(forceRefresh, 100);
            
            console.log("Filters reset, books count:", get(books).length);
        }, 0);
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
                    navigate("/login");
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

    // Function to handle card click properly
    function handleCardClick(event, book) {
        // Check if we're clicking on a button, dropdown, or other interactive element
        const clickTarget = event.target;
        const isInteractiveElement = 
            clickTarget.tagName === 'BUTTON' || 
            clickTarget.closest('button:not(.publication-card)') || 
            clickTarget.closest('[role="button"]') ||
            clickTarget.closest('.dropdown-menu-content') ||
            clickTarget.closest('.dropdown-menu-trigger') ||
            clickTarget.closest('.dropdown-menu-item');
        
        console.log("Card clicked:", {
            isInteractiveElement,
            targetElement: clickTarget.tagName,
            bookTitle: book.title
        });
        
        // Only open the modal if we're not clicking on an interactive element
        if (!isInteractiveElement) {
            console.log("Opening modal for:", book.title);
            viewingPublication = book;
            viewModalOpen = true;
        }
    }

    // Stop event propagation for dropdown buttons
    function handleDropdownClick(event) {
        event.stopPropagation();
    }
</script>

{#if isLoading}
    <div class="flex justify-center items-center h-screen bg-gray-50">
        <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
    </div>
{:else}
    <div class="min-h-screen flex flex-col bg-gray-50">
        <!-- Top Navigation Bar -->
        <nav class="bg-white border-b border-gray-200 shadow-sm h-16 flex items-center justify-between px-6 md:px-12 sticky top-0 z-50 w-full">
            <div class="flex items-center gap-8">
                <h1 class="text-xl font-bold text-blue-600">TrackMySci</h1>
                
                <div class="hidden md:flex items-center space-x-6">
                    <button class="text-gray-600 hover:text-blue-600" on:click={() => navigate('/dashboard')}>
                        <Home class="w-4 h-4 inline mr-1" /> Dashboard
                    </button>
                    <button class="text-blue-600 font-medium hover:text-blue-600">
                        <BookText class="w-4 h-4 inline mr-1" /> Library
                    </button>
                    <button class="text-gray-600 hover:text-blue-600" on:click={() => navigate('/analytics')}>
                        <BarChart class="w-4 h-4 inline mr-1" /> Analytics
                    </button>
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
        <div class="flex-1 bg-gray-50 pt-8 pb-12 px-6 md:px-12 max-w-6xl mx-auto w-full">
            <!-- Library Card Container -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <!-- Header Section -->
                <div class="p-6 border-b border-gray-100">
                    <!-- Title Row -->
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-2xl font-bold text-gray-800">My Publications</h2>
                    </div>
                    
                    <!-- Search and Filter Controls -->
                    <div class="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                        <!-- Search Bar -->
                        <div class="relative w-full md:w-2/3">
                            <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <input 
                                type="text" 
                                placeholder="Search by title or author..." 
                                class="w-full h-10 pl-10 pr-4 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                bind:value={searchLibraryQuery} 
                                on:input={() => {
                                    console.log("Search input:", searchLibraryQuery);
                                    updateFilteredBooks();
                                    forceRefresh();
                                }}
                            />
                        </div>
                        
                        <!-- Right Side Controls (Filter Dropdown and View Toggle) -->
                        <div class="flex gap-2 items-center">
                            <!-- Combined Filter Dropdown -->
                            <Popover.Root>
                                <Popover.Trigger class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50">
                                    <Filter class="h-4 w-4 mr-2 text-gray-500" />
                                    Filters
                                    {#if searchLibraryQuery || selectedStatusFilter !== "all" || selectedTagFilter !== "all" || selectedAuthorFilter !== "all" || selectedRatingFilter !== "all"}
                                        <span class="ml-2 flex items-center justify-center size-5 bg-blue-100 text-blue-600 text-xs font-medium rounded-full">
                                            {(selectedTagFilter !== "all" ? 1 : 0) + 
                                             (selectedAuthorFilter !== "all" ? 1 : 0) + 
                                             (selectedRatingFilter !== "all" ? 1 : 0) + 
                                             (selectedStatusFilter !== "all" ? 1 : 0)}
                                        </span>
                                    {/if}
                                    <ChevronDown class="h-4 w-4 ml-2 text-gray-500" />
                                </Popover.Trigger>
                                <Popover.Content side="bottom" class="w-[40rem] p-4 rounded-md shadow-xl bg-white border border-gray-200">
                                    <!-- Horizontal Layout for Filter Sections -->
                                    <div class="space-y-4">
                                        <!-- Top Row - Tags & Author Filters -->
                                        <div class="grid grid-cols-2 gap-4">
                                            <!-- Tag Filter Section -->
                                            <div>
                                                <h3 class="text-sm font-medium text-gray-700 mb-2">Filter by Tag</h3>
                                                <div class="space-y-1 max-h-40 overflow-y-auto pr-2">
                                                    <button 
                                                        class={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${selectedTagFilter === "all" ? "bg-blue-50 text-blue-600 font-medium" : ""}`}
                                                        on:click={() => {
                                                            selectedTagFilter = "all";
                                                            updateFilteredBooks();
                                                            forceRefresh();
                                                        }}
                                                    >
                                                        All Tags
                                                    </button>
                                                    {#each $uniqueTags as tag}
                                                        <button 
                                                            class={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${selectedTagFilter === tag ? "bg-blue-50 text-blue-600 font-medium" : ""}`}
                                                            on:click={() => {
                                                                selectedTagFilter = tag;
                                                                updateFilteredBooks();
                                                                forceRefresh();
                                                            }}
                                                        >
                                                            {tag}
                                                        </button>
                                                    {/each}
                                                </div>
                                            </div>
                                            
                                            <!-- Author Filter Section -->
                                            <div>
                                                <h3 class="text-sm font-medium text-gray-700 mb-2">Filter by Author</h3>
                                                <div class="space-y-1 max-h-40 overflow-y-auto pr-2">
                                                    <button 
                                                        class={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${selectedAuthorFilter === "all" ? "bg-blue-50 text-blue-600 font-medium" : ""}`}
                                                        on:click={() => {
                                                            selectedAuthorFilter = "all";
                                                            console.log("Author filter reset to 'all'");
                                                            updateFilteredBooks();
                                                            forceRefresh();
                                                        }}
                                                    >
                                                        All Authors
                                                    </button>
                                                    {#each $uniqueAuthors as author}
                                                        <button 
                                                            class={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${selectedAuthorFilter === author ? "bg-blue-50 text-blue-600 font-medium" : ""}`}
                                                            on:click={() => {
                                                                selectedAuthorFilter = author;
                                                                console.log(`Author filter set to: "${author}"`);
                                                                updateFilteredBooks();
                                                                forceRefresh();
                                                            }}
                                                        >
                                                            {author}
                                                        </button>
                                                    {/each}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <Separator />
                                        
                                        <!-- Bottom Row - Rating & Status Filters -->
                                        <div class="grid grid-cols-2 gap-4">
                                            <!-- Rating Filter Section -->
                                            <div>
                                                <h3 class="text-sm font-medium text-gray-700 mb-2">Filter by Rating</h3>
                                                <div class="space-y-1">
                                                    <button 
                                                        class={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${selectedRatingFilter === "all" ? "bg-blue-50 text-blue-600 font-medium" : ""}`}
                                                        on:click={() => {
                                                            selectedRatingFilter = "all";
                                                            console.log("Rating filter reset to 'all'");
                                                            updateFilteredBooks();
                                                            forceRefresh();
                                                        }}
                                                    >
                                                        Any Rating
                                                    </button>
                                                    {#each [5, 4, 3, 2, 1] as rating}
                                                        <button 
                                                            class={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${selectedRatingFilter === rating.toString() ? "bg-blue-50 text-blue-600 font-medium" : ""}`}
                                                            on:click={() => {
                                                                selectedRatingFilter = rating.toString();
                                                                console.log(`Rating filter set to: ${rating} stars`);
                                                                updateFilteredBooks();
                                                                forceRefresh();
                                                            }}
                                                        >
                                                            <div class="flex items-center">
                                                                {#each Array(5) as _, i}
                                                                    <span class="text-yellow-400">
                                                                        {#if i < rating}
                                                                            ★
                                                                        {:else}
                                                                            ☆
                                                                        {/if}
                                                                    </span>
                                                                {/each}
                                                                <span class="ml-1">{rating} Star{rating !== 1 ? 's' : ''}</span>
                                                            </div>
                                                        </button>
                                                    {/each}
                                                </div>
                                            </div>
                                            
                                            <!-- Status Filter Section -->
                                            <div>
                                                <h3 class="text-sm font-medium text-gray-700 mb-2">Filter by Status</h3>
                                                <div class="space-y-1">
                                                    <button 
                                                        class={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${selectedStatusFilter === "all" ? "bg-blue-50 text-blue-600 font-medium" : ""}`}
                                                        on:click={() => {
                                                            selectedStatusFilter = "all";
                                                            updateFilteredBooks();
                                                            forceRefresh();
                                                        }}
                                                    >
                                                        All Statuses
                                                    </button>
                                                    <button 
                                                        class={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${selectedStatusFilter === "completed" ? "bg-blue-50 text-blue-600 font-medium" : ""}`}
                                                        on:click={() => {
                                                            selectedStatusFilter = "completed";
                                                            updateFilteredBooks();
                                                            forceRefresh();
                                                        }}
                                                    >
                                                        <div class="flex items-center">
                                                            <span class="inline-block w-3 h-3 rounded-full bg-green-400 mr-2"></span>
                                                            Completed
                                                        </div>
                                                    </button>
                                                    <button 
                                                        class={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${selectedStatusFilter === "in-progress" ? "bg-blue-50 text-blue-600 font-medium" : ""}`}
                                                        on:click={() => {
                                                            selectedStatusFilter = "in-progress";
                                                            updateFilteredBooks();
                                                            forceRefresh();
                                                        }}
                                                    >
                                                        <div class="flex items-center">
                                                            <span class="inline-block w-3 h-3 rounded-full bg-blue-400 mr-2"></span>
                                                            In Progress
                                                        </div>
                                                    </button>
                                                    <button 
                                                        class={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${selectedStatusFilter === "unread" ? "bg-blue-50 text-blue-600 font-medium" : ""}`}
                                                        on:click={() => {
                                                            selectedStatusFilter = "unread";
                                                            updateFilteredBooks();
                                                            forceRefresh();
                                                        }}
                                                    >
                                                        <div class="flex items-center">
                                                            <span class="inline-block w-3 h-3 rounded-full bg-gray-400 mr-2"></span>
                                                            Unread
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <!-- Reset Filters Button -->
                                        {#if searchLibraryQuery || selectedStatusFilter !== "all" || selectedTagFilter !== "all" || selectedAuthorFilter !== "all" || selectedRatingFilter !== "all"}
                                            <div class="pt-3 border-t border-gray-200 mt-3">
                                                <button 
                                                    class="w-full flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md bg-red-50 text-red-600 hover:bg-red-100"
                                                    on:click={() => {
                                                        console.log("Clear filters button clicked");
                                                        searchLibraryQuery = "";
                                                        selectedStatusFilter = "all";
                                                        selectedTagFilter = "all";
                                                        selectedAuthorFilter = "all";
                                                        selectedRatingFilter = "all";
                                                        // Force immediate update
                                                        updateFilteredBooks();
                                                        forceRefresh();
                                                    }}
                                                >
                                                    <X class="h-4 w-4 mr-1" /> Reset All Filters
                                                </button>
                                            </div>
                                        {/if}
                                    </div>
                                </Popover.Content>
                            </Popover.Root>
                            
                            <!-- Clear Filters Button - only shown if filters are active -->
                            {#if searchLibraryQuery || selectedStatusFilter !== "all" || selectedTagFilter !== "all" || selectedAuthorFilter !== "all" || selectedRatingFilter !== "all"}
                                <button 
                                    class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-red-600 hover:text-red-700"
                                    on:click={() => {
                                        console.log("Clear filters button clicked");
                                        searchLibraryQuery = "";
                                        selectedStatusFilter = "all";
                                        selectedTagFilter = "all";
                                        selectedAuthorFilter = "all";
                                        selectedRatingFilter = "all";
                                        // Force immediate update
                                        updateFilteredBooks();
                                        forceRefresh();
                                    }}
                                >
                                    <X class="h-4 w-4 mr-1" /> Clear
                                </button>
                            {/if}
                            
                            <!-- View Toggle -->
                            <div class="flex rounded-md overflow-hidden border border-gray-200">
                                <button 
                                    class={`flex items-center justify-center w-10 h-10 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-700 font-medium' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                    on:click={() => toggleViewMode('grid')}
                                >
                                    <LayoutGrid class="h-4 w-4" />
                                </button>
                                <button 
                                    class={`flex items-center justify-center w-10 h-10 ${viewMode === 'list' ? 'bg-blue-50 text-blue-700 font-medium' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                    on:click={() => toggleViewMode('list')}
                                >
                                    <List class="h-4 w-4" />
                                </button>
                            </div>
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
                                        <!-- Card container - using button for better accessibility -->
                                        <button 
                                            class="publication-card block text-left w-full bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden h-64 flex flex-col relative cursor-pointer hover:shadow-md hover:bg-blue-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                                            on:click={(event) => handleCardClick(event, book)}
                                            aria-label={`View details for ${book.title}`}>
                                            <!-- Card Header with Menu -->
                                            <div class="absolute top-2 right-2 z-30" on:click={handleDropdownClick}>
                                                <DropdownMenu.Root>
                                                    <DropdownMenu.Trigger class="dropdown-menu-trigger">
                                                        <button class="text-gray-400 hover:text-gray-700 bg-white rounded-full p-1.5">
                                                            <Ellipsis class="h-4 w-4" />
                                                        </button>
                                                    </DropdownMenu.Trigger>
                                                    <DropdownMenu.Content class="dropdown-menu-content">
                                                        <DropdownMenu.Group>
                                                            <DropdownMenu.Item on:click={() => openViewModal(book)} class="text-sm dropdown-menu-item">
                                                                <Book class="w-4 h-4 mr-2" /> View Details
                                                            </DropdownMenu.Item>
                                                            <DropdownMenu.Item on:click={() => openEditModal(book)} class="text-sm dropdown-menu-item">
                                                                <Edit class="w-4 h-4 mr-2" /> Edit
                                                            </DropdownMenu.Item>
                                                            <DropdownMenu.Item on:click={() => deletePublication(book.id)} class="text-sm text-red-600 dropdown-menu-item">
                                                                <Trash2 class="w-4 h-4 mr-2" /> Delete
                                                            </DropdownMenu.Item>
                                                        </DropdownMenu.Group>
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
                                                <div class="mt-auto pt-3 border-t border-gray-100">
                                                    <div class="text-sm text-gray-600 text-right">
                                                        {book.totalPagesRead || 0} pages read
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    {/each}
                                </div>
                            {:else}
                                <!-- Display as List -->
                                <div class="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                    {#each getPaginatedBooks() as book, index}
                                        <!-- List item - using button for better accessibility -->
                                        <button 
                                            class="publication-card block text-left w-full relative hover:bg-blue-50 transition-all duration-200 cursor-pointer focus:outline-none focus:bg-blue-50" 
                                            on:click={(event) => handleCardClick(event, book)}
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
                                                        <div class="flex-shrink-0" on:click={handleDropdownClick}>
                                                            <DropdownMenu.Root>
                                                                <DropdownMenu.Trigger class="dropdown-menu-trigger">
                                                                    <button class="text-gray-400 hover:text-gray-700 bg-white rounded-full p-1.5">
                                                                        <Ellipsis class="h-4 w-4" />
                                                                    </button>
                                                                </DropdownMenu.Trigger>
                                                                <DropdownMenu.Content class="dropdown-menu-content">
                                                                    <DropdownMenu.Group>
                                                                        <DropdownMenu.Item on:click={() => openViewModal(book)} class="text-sm dropdown-menu-item">
                                                                            <Book class="w-4 h-4 mr-2" /> View Details
                                                                        </DropdownMenu.Item>
                                                                        <DropdownMenu.Item on:click={() => openEditModal(book)} class="text-sm dropdown-menu-item">
                                                                            <Edit class="w-4 h-4 mr-2" /> Edit
                                                                        </DropdownMenu.Item>
                                                                        <DropdownMenu.Item on:click={() => deletePublication(book.id)} class="text-sm text-red-600 dropdown-menu-item">
                                                                            <Trash2 class="w-4 h-4 mr-2" /> Delete
                                                                        </DropdownMenu.Item>
                                                                    </DropdownMenu.Group>
                                                                </DropdownMenu.Content>
                                                            </DropdownMenu.Root>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
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
                                
                                {#if searchLibraryQuery || selectedStatusFilter !== "all" || selectedTagFilter !== "all" || selectedAuthorFilter !== "all" || selectedRatingFilter !== "all"}
                                    <p class="text-sm text-gray-500 mt-2 max-w-md">
                                        No publications match your current filters. Try adjusting your search criteria or reset filters.
                                    </p>
                                    <Button class="mt-4" variant="outline" on:click={() => {
                                        console.log("Empty state Reset Filters button clicked");
                                        console.log("Before reset - Filter state:", { 
                                            searchLibraryQuery, 
                                            selectedStatusFilter, 
                                            selectedTagFilter, 
                                            selectedAuthorFilter, 
                                            selectedRatingFilter 
                                        });
                                        resetFilters();
                                        console.log("After reset - Filter state:", { 
                                            searchLibraryQuery, 
                                            selectedStatusFilter, 
                                            selectedTagFilter, 
                                            selectedAuthorFilter, 
                                            selectedRatingFilter 
                                        });
                                    }}>
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

<!-- View Publication Dialog -->
<Dialog.Root bind:open={viewModalOpen}>
    <Dialog.Content class="w-[75%] max-w-[75%]">
        <Dialog.Header>
            <Dialog.Title class="text-2xl font-bold">
                {#if viewingPublication}
                    <div class="flex items-center gap-2">
                        <span>{viewingPublication.title}</span>
                        <span class={`px-3 py-1 rounded-full text-sm font-normal ${
                            viewingPublication.completed ? "bg-green-100 text-green-800" : 
                            viewingPublication.readingSessions?.length > 0 ? "bg-blue-100 text-blue-800" : 
                            "bg-gray-100 text-gray-800"
                        }`}>
                            {#if viewingPublication.status}
                                {viewingPublication.status.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                            {:else}
                                {(viewingPublication.completed ? "Completed" : viewingPublication.readingSessions?.length > 0 ? "In Progress" : "Unread")}
                            {/if}
                        </span>
                    </div>
                {/if}
            </Dialog.Title>
            <Dialog.Description>
                {#if viewingPublication}
                    <p class="text-lg text-neutral-600 mb-2">{viewingPublication.author}</p>
                    
                    <!-- Tags -->
                    {#if viewingPublication.tags?.length > 0}
                        <div class="flex flex-wrap gap-2 mb-4">
                            {#each viewingPublication.tags as tag}
                                <span class="bg-neutral-100 text-neutral-800 px-3 py-1 rounded-full text-sm">{tag}</span>
                            {/each}
                        </div>
                    {/if}
                    
                    {#if viewingPublication.isbn}
                        <p class="text-sm text-neutral-600 mt-2">ISBN/DOI: {viewingPublication.isbn}</p>
                    {/if}
                    
                    <!-- Divider -->
                    <hr class="my-4 border-neutral-200" />
                    
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
                                
                                <div class="max-h-[500px] overflow-y-auto pr-2">
                                    {#each viewingPublication.readingSessions as session}
                                        <div class="bg-white border border-neutral-200 rounded-lg p-4 mb-3">
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
                                                <p class="text-neutral-700 bg-neutral-50 p-3 rounded-md mt-2 whitespace-pre-wrap">{session.notes}</p>
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {:else}
                            <div class="text-center p-6 bg-neutral-50 rounded-lg">
                                <p class="text-neutral-500">No reading sessions yet.</p>
                                <p class="text-sm text-neutral-400 mt-1">Start tracking your reading by clicking "Log Reading".</p>
                            </div>
                        {/if}

                        <!-- Mark as Complete/Incomplete button -->
                        <div class="mt-4">
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
  <Dialog.Content class="w-[90%] max-w-4xl mx-auto">
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