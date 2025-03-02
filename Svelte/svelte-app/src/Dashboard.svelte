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
    import {
      doc,
      getDoc,
      setDoc,
      collection,
      addDoc,
      query,
      where,
      getDocs,
      updateDoc,
      deleteDoc
    } from "firebase/firestore";
    import {
      MoreVertical,
      Edit,
      Trash2,
      FilePlus2,
      Gauge,
      Library,
      LogOut,
      SquarePen,
      ChevronDown,
      Ellipsis
    } from "lucide-svelte";
    import SimpleChart from "./lib/components/ui/charts/SimpleChart.svelte";
    import Chart from "chart.js/auto";
    import { onMount } from "svelte";
    import TagsChart from "./lib/components/ui/charts/TagsChart.svelte";
    import RatingsChart from "./lib/components/ui/charts/RatingsChart.svelte";
    import ProgressChart from "./lib/components/ui/charts/ProgressChart.svelte";
    import TimelineChart from "./lib/components/ui/charts/TimelineChart.svelte";
    import PieChart from "./lib/components/ui/charts/PieChart.svelte";
    import StreakChart from "./lib/components/ui/charts/StreakChart.svelte";
  
    let currentStreak = 5; // Example streak; replace with your logic
  
    async function searchLiterature() {
    // Reset previous results
    showResults = false;
    searchResults = [];
    isbn = "";

    console.log("Search query:", searchQuery);

    if (/^10\.\d{4,9}\/[-._;()\/:A-Za-z0-9]+$/.test(searchQuery)) {
      console.log("Query looks like a DOI. Calling fetchDOI...");
      await fetchDOI();
    } else if (/^(97(8|9))?\d{9}(\d|X)$/.test(searchQuery)) {
      console.log("Query looks like an ISBN. Calling fetchISBN...");
      isbn = searchQuery;
      await fetchISBN();
    } else {
      console.log("Query treated as Title. Calling fetchTitle...");
      title = searchQuery;
      await fetchTitle();
    }

    console.log("Search results after fetch:", searchResults);
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
      console.log("CrossRef response:", data);
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

  async function fetchISBN() {
    try {
      console.log("Fetching ISBN:", isbn);
      const response = await fetch(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
      );
      const data = await response.json();
      console.log("Raw ISBN API response:", data);
      if (!data[`ISBN:${isbn}`]) {
        console.warn("No ISBN data found in response.");
        searchResults = [];
        return;
      }
      const bookData = data[`ISBN:${isbn}`];
      console.log("Book Data:", bookData);
      let pageEnd = bookData.number_of_pages || null;
      if (!pageEnd && bookData.pagination) {
        pageEnd = parseInt(bookData.pagination.replace(/\D/g, ""), 10) || null;
      }
      searchResults = [
        {
          title: bookData.title || "Unknown Title",
          author: bookData.authors
            ? bookData.authors.map((a) => a.name).join(", ")
            : "Unknown Author",
          isbn: isbn,
          pageEnd: pageEnd || "Unknown Pages"
        }
      ];
      console.log("Final Search Result (ISBN):", searchResults);
    } catch (error) {
      console.error("Error fetching ISBN data:", error);
      alert("Failed to retrieve ISBN information.");
    }
  }

  async function fetchTitle() {
    try {
      console.log("Fetching Title for:", title);
      const response = await fetch(
        `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}`
      );
      const data = await response.json();
      console.log("Full API Response (Title):", data);
      if (!data.docs || data.docs.length === 0) {
        console.warn("No title data found.");
        searchResults = [];
        return;
      }
      searchResults = await Promise.all(
        data.docs.slice(0, 10).map(async (doc) => {
          console.log("Processing book:", doc);
          let isbn = doc.isbn ? doc.isbn[0] : null;
          let pageEnd = null;
          if (!isbn && doc.key) {
            const editionData = await fetchISBNFromEditions(doc.key);
            isbn = editionData?.isbn || null;
            pageEnd = editionData?.pageCount || null;
          }
          return {
            title: doc.title || "Unknown Title",
            author: doc.author_name ? doc.author_name.join(", ") : "Unknown Author",
            isbn: isbn || "No ISBN",
            pageEnd: pageEnd || "Unknown Pages"
          };
        })
      );
      console.log("Final Search Results (Title):", searchResults);
    } catch (error) {
      console.error("Error fetching title data:", error);
      alert("Failed to retrieve title information.");
    }
  }

  async function fetchISBNFromEditions(workKey) {
    try {
      console.log("Fetching ISBN and page count from editions for:", workKey);
      const response = await fetch(`https://openlibrary.org${workKey}/editions.json`);
      const data = await response.json();
      console.log("Editions Data:", data);
      if (data.entries && data.entries.length > 0) {
        for (const entry of data.entries) {
          let isbn = entry.isbn_10 ? entry.isbn_10[0] : entry.isbn_13 ? entry.isbn_13[0] : null;
          let pageCount = entry.number_of_pages || null;
          if (!pageCount && entry.pagination) {
            pageCount = parseInt(entry.pagination.replace(/\D/g, ""), 10) || null;
          }
          if (isbn || pageCount) {
            return { isbn, pageCount };
          }
        }
      }
      console.warn("No ISBN or page count found in editions for:", workKey);
      return { isbn: null, pageCount: null };
    } catch (error) {
      console.error("Error fetching ISBN from editions:", error);
      return { isbn: null, pageCount: null };
    }
  }
  
    // Stores for selected chart options
    import { writable } from "svelte/store";
    let selectedPieChart = writable("Tags");
    let selectedTimeline = writable("30 Days");
    let selectedProgress = writable("All Progress");
    let progressPercentage = writable(75);
  
    const pieChartOptions = ["Tags", "Ratings", "Authors"];
    const timelineOptions = ["30 Days", "60 Days", "90 Days"];
    const progressOptions = ["All Progress", "Most Recent Book Progress"];
  
    // Variables for progress updates
    let newCurrentPage = 0;
    let progressComment = "";
  
    // Publication management variables
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
    let tagInput = "";
    let tags = [];
    let firstName = "Guest";
    let lastName = "";
    let errorMessage = "";
  
    // Loading state
    let authReady = false;
    let libraryList = [];
  
    // Modal and editing state
    let modalOpen = false;
    let trackingPageOpen = false;
    let editMode = false;
    let editingPublication = null;
  
    // ----- Modal Helper Functions -----
    // Open modal in "add" mode (for new publication)
    function openAddModal() {
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
      isbn = pub.isbn;
      pageStart = pub.pageStart;
      pageEnd = pub.pageEnd;
      currentPage = pub.currentPage;
      tags = pub.tags || [];
      modalOpen = true;
    }
  
    function closeModal() {
      modalOpen = false;
      trackingPageOpen = false;
      editMode = false;
      editingPublication = null;
      resetFields();
    }
  
    // ----- Firestore & Auth Functions -----
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
        libraryList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (error) {
        console.error("Error fetching library:", error.message);
      }
    }
  
    async function updateProgress(entryId, newCurrentPage, pageStart, comment) {
      const user = auth.currentUser;
      if (!user) {
        console.error("No authenticated user found.");
        return;
      }
      try {
        const userDocRef = doc(firestore, "users", user.uid);
        const entryDocRef = doc(collection(userDocRef, "library"), entryId);
        const entryDocSnap = await getDoc(entryDocRef);
        let journalLogs = [];
        let previousPage = pageStart;
        if (entryDocSnap.exists()) {
          const entryData = entryDocSnap.data();
          journalLogs = entryData.journalLogs || [];
          previousPage = entryData.currentPage || pageStart;
        }
        const pagesRead = Math.max(newCurrentPage - previousPage, 0);
        const logEntry = {
          dateTitle: new Date().toLocaleDateString(),
          fromPage: previousPage,
          toPage: newCurrentPage,
          pagesRead: pagesRead,
          comment: comment || "",
          date: new Date().toISOString()
        };
        journalLogs.push(logEntry);
        await updateDoc(entryDocRef, {
          currentPage: newCurrentPage,
          updatedAt: new Date(),
          pagesRead: pagesRead,
          journalLogs: journalLogs
        });
        console.log(`Updated entry ${entryId}: ${previousPage} ➝ ${newCurrentPage}, pages read: ${pagesRead}, comment: ${comment}`);
        await loadUserLibrary();
      } catch (error) {
        console.error("Error updating progress:", error.message);
      }
    }
  
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
        const userDocRef = doc(firestore, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
          await setDoc(userDocRef, { createdAt: new Date() });
        }
        const chartsDocRef = doc(collection(userDocRef, "charts"), "summary");
        // (Calculation details omitted for brevity)
        let mostRecentEntry = null;
        for (const entry of libraryList) {
          let entryDate = entry.updatedAt
            ? (typeof entry.updatedAt.toDate === "function" ? entry.updatedAt.toDate() : new Date(entry.updatedAt))
            : null;
          if (!entryDate) continue;
          if (!mostRecentEntry || entryDate > mostRecentEntry.date) {
            mostRecentEntry = { title: entry.title, date: entryDate };
          }
        }
        const mostRecent = mostRecentEntry ? mostRecentEntry.title : "None";
        const chartsData = { mostRecent, updatedAt: new Date() };
        await setDoc(chartsDocRef, chartsData, { merge: true });
        console.log("Charts updated:", chartsData);
      } catch (error) {
        console.error("Error updating charts:", error.message);
      }
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
  
    // Reset fields for modal
    function resetFields() {
      searchQuery = title = author = isbn = comment = "";
      pageStart = 1;
      pageEnd = 1;
      currentPage = 1;
      searchResults = [];
      showResults = false;
      tagInput = "";
      tags = [];
    }
  
    // Firestore add/update functions
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
        console.log("Checking new entry ISBN:", newEntry.isbn);
        const isbnQuery = query(libraryRef, where("isbn", "==", newEntry.isbn));
        const querySnapshot = await getDocs(isbnQuery);
        console.log(`Query result for ISBN "${newEntry.isbn}" -> empty:`, querySnapshot.empty);
        if (!querySnapshot.empty) {
          alert("This article is already in your library!");
          resetFields();
          return;
        }
        const pagesRead = newEntry.currentPage - newEntry.pageStart + 1;
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
          updatedAt: new Date(),
          pagesRead: pagesRead
        });
        console.log(`Added entry with ISBN ${newEntry.isbn}.`);
        libraryList = [newEntry, ...libraryList];
        resetFields();
        modalOpen = false;
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
        await saveEntryToFirestore(newEntry);
        await loadUserLibrary();
        await updateCharts();
      } else {
        alert("Please fill in all required fields before adding.");
      }
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
        await updateDoc(entryDocRef, {
          title,
          author,
          isbn,
          pageStart,
          pageEnd,
          currentPage,
          tags,
          updatedAt: new Date()
        });
        console.log(`Updated publication: ${editingPublication.id}`);
        await loadUserLibrary();
        closeModal();
      } catch (error) {
        console.error("Error updating publication:", error.message);
      }
    }
  
    function logout() {
      signOut(auth).then(() => {
        userStore.set(null);
        navigate("/login");
      });
    }
  
    // For dropdown demo (not used in modal)
    let selectedComponent = TagsChart;
    function handleSelection(event) {
      const value = event.target.value;
      console.log("Selected Value:", value);
      switch (value.trim()) {
        case "option1":
          selectedComponent = TagsChart;
          break;
        case "option2":
          selectedComponent = RatingsChart;
          break;
        default:
          console.log("No valid option selected");
          selectedComponent = null;
      }
    }

    function selectResult(result) {
        title = result.title;
        author = result.author;
        isbn = result.isbn;
        pageStart = 1;
        pageEnd = result.pageEnd !== "Unknown Pages" ? result.pageEnd : 1;
        currentPage = 1;
        showResults = false; // Hide the search results dropdown after selection

        console.log(`Selected book: ${title}, ISBN: ${isbn}, Total Pages: ${pageEnd}`);
    }

    async function deletePublication(publicationId) {
        const user = auth.currentUser;
        if (!user) {
            console.error("No authenticated user found.");
            return;
        }

        // Ask for confirmation
        const confirmDelete = confirm("Are you sure you want to delete this publication?");
        if (!confirmDelete) return;

        try {
            // Reference the document inside the user's library subcollection
            const userDocRef = doc(firestore, "users", user.uid);
            const entryDocRef = doc(userDocRef, "library", publicationId);

            // Delete the document from Firestore
            await deleteDoc(entryDocRef);

            console.log(`Deleted publication with ID: ${publicationId}`);

            // Refresh the UI by updating the local list
            libraryList = libraryList.filter(entry => entry.id !== publicationId);

        } catch (error) {
            console.error("Error deleting publication:", error.message);
        }
    }


  </script>
  
  {#if !authReady}
    <div class="flex justify-center items-center h-screen">
      <p>Loading...</p>
    </div>
  {:else}
    <div class="min-h-screen flex flex-col bg-stone-50">
      <!-- Navbar -->
      <nav class="bg-white border-neutral-400 shadow h-16 flex items-center justify-between px-12 sticky top-0 z-50">
        <h1 class="text-lg font-semibold text-neutral-800">TrackMySci</h1>
        <div class="flex items-center space-x-6">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <button class="border border-neutral-300 py-2 px-4 shadow-sm text-base font-medium rounded hover:bg-neutral-100 flex items-center gap-x-5">
                {firstName + " " + lastName}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-neutral-500">
                  <path fill-rule="evenodd" d="M11.47 4.72a.75.75 0 0 1 1.06 0l3.75 3.75a.75.75 0 0 1-1.06 1.06L12 6.31 8.78 9.53a.75.75 0 0 1-1.06-1.06l3.75-3.75Zm-3.75 9.75a.75.75 0 0 1 1.06 0L12 17.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-3.75 3.75a.75.75 0 0 1-1.06 0l-3.75-3.75a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
                </svg>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Group>
                <DropdownMenu.Item on:click={() => navigate("/dashboard")} class="text-base">
                  <Gauge class="w-7 pr-1.5" /> Dashboard
                </DropdownMenu.Item>
                <DropdownMenu.Item on:click={() => navigate("/library")} class="text-base">
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
  
      <!-- Welcome Message -->
      <div class="pt-12 px-12">
        <h2 class="text-4xl font-bold text-neutral-800">Welcome, {firstName} 👋</h2>
      </div>
  
      <!-- Main Content -->
      <div class="flex flex-1">
        <!-- Publications Section -->
        <section class="w-1/2 py-12 pl-12 pr-3">
          <div>
            <h2 class="text-xl font-semibold mb-4 flex justify-between items-center text-neutral-700">
              Recently Accessed
              <!-- New Publication Trigger -->
              <Dialog.Root bind:open={modalOpen}>
                <Dialog.Trigger on:click={openAddModal}>
                  <Button class="bg-blue-600 hover:bg-blue-700">
                    <FilePlus2 class="w-7 pr-1.5" /> New publication
                  </Button>
                </Dialog.Trigger>
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
                                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197M5.196 5.196a7.5 7.5 0 0 1 10.607 10.607" />
                              </svg>
                            </div>
                          </div>
                        </div>
  
                        {#if showResults}
                        <div class="absolute mt-0.5 space-y-2 max-h-80 overflow-y-auto border border-neutral-300 rounded p-2 bg-white z-50">
                            {#each searchResults as result}
                                <button type="button" 
                                    class="p-3 bg-neutral-100 rounded shadow cursor-pointer hover:bg-neutral-200 text-left w-full"
                                    on:click={() => selectResult(result)}
                                >
                                    <strong>{result.title}</strong><br />
                                    <small>Author: {result.author}</small><br />
                                    {#if result.isbn && result.isbn !== "No ISBN"}
                                        <em>ISBN: {result.isbn}</em>
                                    {/if}
                                    {#if result.doi}
                                        <br /><em>DOI: {result.doi}</em>
                                    {/if}
                                    {#if (!result.isbn || result.isbn === "No ISBN") && !result.doi}
                                        <em>No ISBN or DOI available</em>
                                    {/if}
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
                          <Button type="submit" class="bg-blue-600 text-white hover:bg-blue-700">{editMode ? "Update" : "Add"}</Button>
                        </div>
                      </form>
                    </Dialog.Description>
                  </Dialog.Header>
                </Dialog.Content>
              </Dialog.Root>
            </h2>
          </div>
  
          {#if libraryList.length === 0}
            <div class="flex flex-col items-center justify-center text-center text-gray-500 pt-12">
              <p class="text-lg font-medium">No literature added yet.</p>
              <p class="text-sm mt-2">Start by adding a new publication to track your progress!</p>
            </div>
          {:else}
            <ul class="space-y-3">
              {#each libraryList as lit}
                <li class="p-4 bg-white border border-neutral-300 rounded-md shadow">
                  <div class="flex justify-between">
                    <div class="cursor-pointer" on:click={() => openEditModal(lit)}>
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
                            <DropdownMenu.Item on:click={() => deletePublication(lit.id)} class="text-sm text-red-600">
                                <Trash2 class="w-4 h-4 mr-2" /> Delete
                            </DropdownMenu.Item>
                          </DropdownMenu.Group>
                        </DropdownMenu.Content>
                      </DropdownMenu.Root>
                    </div>
                  </div>
                  {#if lit.tags?.length > 0}
                    <div class="flex flex-wrap gap-2 mt-3">
                      {#each lit.tags as tag}
                        <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">{tag}</span>
                      {/each}
                    </div>
                  {/if}
                  {#if lit.showLogs}
                    <div class="mt-3 p-3 bg-gray-100 border border-gray-300 rounded-md">
                      <h3 class="font-semibold text-sm mb-2">Reading Log:</h3>
                      {#if lit.journalLogs?.length > 0}
                        <ul class="space-y-2">
                          {#each lit.journalLogs as log}
                            <li class="p-2 bg-white border rounded-md shadow-sm">
                              <strong>{log.dateTitle}</strong>
                              <p class="text-sm text-gray-600">From Page {log.fromPage} - To Page {log.toPage}</p>
                              <p class="text-xs text-gray-500">Pages Read: {log.pagesRead}</p>
                              {#if log.comment}
                                <p class="text-xs text-gray-500">"{log.comment}"</p>
                              {/if}
                              <small class="text-xs text-gray-500">{new Date(log.date).toLocaleString()}</small>
                            </li>
                          {/each}
                        </ul>
                      {:else}
                        <p class="text-sm text-gray-500">No logs yet.</p>
                      {/if}
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
                    <Popover.Root bind:open={lit.isUpdating}>
                      <Popover.Trigger on:click={() => {
                        lit.newCurrentPage = lit.currentPage || lit.pageStart;
                        lit.progressComment = "";
                        lit.isUpdating = true;
                      }}>
                        <button class="pt-6 pb-0 mb-0 bg-transparent text-neutral-900 hover:text-neutral-500 transition-all">
                          <SquarePen />
                        </button>
                      </Popover.Trigger>
                      <Popover.Content class="p-4 bg-white shadow-lg border rounded-md w-64">
                        <div>
                          <label class="text-sm font-medium text-neutral-700 mb-2 block">
                            Current Page:
                          </label>
                          <input type="number" min={lit.pageStart} max={lit.pageEnd} bind:value={lit.newCurrentPage} class="w-full p-1 border rounded border-neutral-300 shadow-sm" />
                          <label class="text-sm font-medium text-neutral-700 mt-2 block">
                            Comment:
                          </label>
                          <textarea bind:value={lit.progressComment} class="w-full p-1 border rounded border-neutral-300 shadow-sm" placeholder="Add a note about your reading progress"></textarea>
                        </div>
                        <div class="flex justify-end mt-4">
                          <Button on:click={async () => {
                            await updateProgress(lit.id, lit.newCurrentPage, lit.pageStart, lit.progressComment);
                            lit.isUpdating = false;
                          }} class="bg-blue-600 hover:bg-blue-700 text-white">
                            Save
                          </Button>
                        </div>
                      </Popover.Content>
                    </Popover.Root>
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </section>
  
        <!-- Analytics Section -->
        <section class="w-1/2 py-12 pl-3 pr-12">
          <div class="h-[36.5px] mb-4 items-center">
            <h2 class="text-xl font-semibold mb-4 text-neutral-700">Analytics</h2>
          </div>
          <div class="grid grid-cols-5 gap-4">
            <!-- Row 1: Timeline & Streak -->
            <div class="col-span-3 p-6 h-72 bg-white border border-neutral-300 rounded-md shadow">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <p class="text-lg font-semibold">Pages Read</p>
                </div>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    <button class="border border-neutral-300 py-1 px-2 shadow-sm text-xs font-medium rounded-full hover:bg-neutral-100 flex items-center">
                      {$selectedTimeline}
                      <ChevronDown class="w-4" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content>
                    <DropdownMenu.Group>
                      {#each timelineOptions as option}
                        <DropdownMenu.Item on:click={() => selectedTimeline.set(option)} class="text-sm">
                          {option}
                        </DropdownMenu.Item>
                      {/each}
                    </DropdownMenu.Group>
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </div>
              <div class="flex-1 flex items-center justify-center">
                <TimelineChart selectedRange={$selectedTimeline} />
              </div>
            </div>
            <div class="col-span-2 p-6 h-72 bg-white border border-neutral-300 rounded-md shadow flex flex-col items-center justify-center">
              <p class="text-lg font-semibold text-neutral-800">Current Streak</p>
              <p class="text-5xl font-bold text-blue-500 mt-2">{currentStreak}</p>
              <p class="text-sm text-gray-500">days in a row</p>
            </div>
            <!-- Row 2: Progress & Distribution -->
            <div class="col-span-2 p-6 h-72 bg-white border border-neutral-300 rounded-md shadow flex flex-col">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-lg font-semibold">Distribution</p>
                </div>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    <button class="border border-neutral-300 py-1 px-2 shadow-sm text-xs font-medium rounded-full hover:bg-neutral-100 flex items-center">
                      {$selectedPieChart}
                      <ChevronDown class="w-4" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content>
                    <DropdownMenu.Group>
                      {#each pieChartOptions as option}
                        <DropdownMenu.Item on:click={() => selectedPieChart.set(option)} class="text-sm">
                          {option}
                        </DropdownMenu.Item>
                      {/each}
                    </DropdownMenu.Group>
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </div>
              <div class="flex-1 flex items-center justify-center max-h-64 w-full">
                <PieChart type={$selectedPieChart} />
              </div>
            </div>
            <div class="col-span-3 p-6 h-72 bg-white border border-neutral-300 rounded-md shadow flex flex-col">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <p class="text-lg font-semibold">Progress</p>
                </div>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    <button class="border border-neutral-300 py-1 px-2 shadow-sm text-xs font-medium rounded-full hover:bg-neutral-100 flex items-center">
                      {$selectedProgress}
                      <ChevronDown class="w-4" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content>
                    <DropdownMenu.Group>
                      {#each progressOptions as option}
                        <DropdownMenu.Item on:click={() => selectedProgress.set(option)} class="text-sm">
                          {option}
                        </DropdownMenu.Item>
                      {/each}
                    </DropdownMenu.Group>
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </div>
              <div class="text-center mb-3">
                <p class="text-4xl font-bold text-blue-600">{$progressPercentage}%</p>
                <p class="text-sm text-gray-500">of total reading completed</p>
              </div>
              <div class="relative w-full h-6 bg-gray-200 rounded-full">
                <div class="absolute top-0 left-0 h-6 bg-blue-500 rounded-full transition-all" style="width: {$progressPercentage}%;">
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  {/if}
  