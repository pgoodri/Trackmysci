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
  import { writable } from "svelte/store";
  import { writeBatch } from "firebase/firestore";
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
    deleteDoc,
    orderBy,
    limit
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
    ChevronsUpDown,
    Ellipsis,
    Filter,
    BookOpen,
    Clock,
    Calendar,
    Book,
    Search,
    Percent
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

  let chartKey = writable(0); // Used to force chart re-render
  let chartRefreshKey = writable(0);
  let currentStreak = writable(0); // Initialize streak to 0
  const batch = writeBatch(firestore);

  let isSearching = false; // Add this for spinner state

  onMount(() => {
    // Initialize properties for each publication in the library list
    if (libraryList && libraryList.length > 0) {
      libraryList.forEach(lit => {
        lit.newCurrentPage = lit.currentPage || lit.pageStart;
        lit.progressComment = "";
        lit.isUpdating = false;
      });
    }
  });

  async function searchLiterature() {
    // Reset previous results
    showResults = false;
    searchResults = [];
    isbn = "";
    isSearching = true; // Set searching state to true

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
    
    isSearching = false; // Set searching state back to false
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
  let selectedPieChart = writable("Tags");
  let selectedTimeline = writable("30 Days");
  let selectedProgress = writable("All Progress");
  let progressPercentage = writable(0); // Initially 0, will update dynamically

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

  let viewingPublication = null;  // Will store the entire publication object
  let viewModalOpen = false;      // Controls if the "view publication details" modal is open

  // Log Reading modal variables
  let logReadingModalOpen = false;
  let logReadingPublication = null;
  let logReadingNewPage = 0;
  let logReadingComment = "";
  
  
  function openViewModal(pub) {
      viewingPublication = pub;
      viewModalOpen = true;
  }

  function closeViewModal() {
      viewingPublication = null;
      viewModalOpen = false;
  }
  

  // Function to open the log reading modal
  function openLogReadingModal() {
    // If there are publications in the library, select the first one by default
    if (libraryList.length > 0) {
      logReadingPublication = libraryList[0].id;
      const publication = libraryList.find(p => p.id === logReadingPublication);
      if (publication) {
        logReadingNewPage = publication.currentPage || publication.pageStart;
      }
    }
    logReadingComment = "";
    logReadingModalOpen = true;
  }

  // Function to save reading log via modal
  async function saveReadingLog() {
    if (!logReadingPublication || !logReadingNewPage) return;
    
    const publication = libraryList.find(p => p.id === logReadingPublication);
    if (publication) {
      await updateProgress(
        logReadingPublication, 
        logReadingNewPage, 
        publication.pageStart, 
        logReadingComment
      );
      logReadingModalOpen = false;
    }
  }

  // Function to handle publication selection in the log reading modal
  function handlePublicationSelection(pubId) {
    logReadingPublication = pubId;
    const publication = libraryList.find(p => p.id === pubId);
    if (publication) {
      logReadingNewPage = publication.currentPage || publication.pageStart;
    }
  }

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
      console.log("Closing modal...");
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
      }

      // 🔥 Check Streak Status
      const summaryDocRef = doc(collection(firestore, "users", user.uid, "charts"), "summary");
      const summaryDocSnap = await getDoc(summaryDocRef);

      if (summaryDocSnap.exists()) {
          const summaryData = summaryDocSnap.data();
          let streak = summaryData.streak || 0;
          let streakDate = summaryData.streakDate || null;
          let today = new Date().toISOString().split("T")[0];

          if (streakDate) {
              const lastLogDate = new Date(streakDate);
              const timeDiff = Math.floor((new Date(today) - lastLogDate) / (1000 * 60 * 60 * 24));

              if (timeDiff >= 2) {
                  console.log("⏳ Streak expired. Resetting...");
                  await setDoc(summaryDocRef, { streak: 0, streakDate: null }, { merge: true });
                  streak = 0;
              }
          }
          currentStreak.set(streak);
          console.log(` Current streak: ${streak} days`);
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
      const querySnapshot = await getDocs(libraryRef);

      // Fetch user ratings
      const ratingsDocRef = doc(userDocRef, "charts", "ratings");
      const ratingsSnap = await getDoc(ratingsDocRef);
      const ratingsData = ratingsSnap.exists() ? ratingsSnap.data() : {};

      libraryList = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return { id: docSnap.id, ...data, rating: data.rating || 0 };
      });

      console.log("📚 Loaded library with ratings:", libraryList);
  } catch (error) {
      console.error("❌ Error loading library:", error.message);
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
      const summaryDocRef = doc(collection(userDocRef, "charts"), "summary");

      const entryDocSnap = await getDoc(entryDocRef);
      const summaryDocSnap = await getDoc(summaryDocRef);

      let journalLogs = [];
      let previousPage = pageStart;
      let streak = 0;
      let streakDate = null;
      let today = new Date().toISOString().split("T")[0]; // Get current date (YYYY-MM-DD)
      let readingLog = [];

      if (entryDocSnap.exists()) {
          const entryData = entryDocSnap.data();
          journalLogs = entryData.journalLogs || [];
          previousPage = entryData.currentPage || pageStart;
      }

      if (summaryDocSnap.exists()) {
          const summaryData = summaryDocSnap.data();
          streak = summaryData.streak || 0;
          streakDate = summaryData.streakDate || null;
          readingLog = summaryData.readingLog || [];
      }

      // ✅ Calculate Pages Read
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

      // 🔥 **Streak Logic**
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
              streak = 0;
              streakDate = null;
          }
      }

      // 📊 **Update Reading Log (for Timeline Chart)**
      let updatedLog = readingLog.map(log => ({ ...log })); // Clone array to avoid mutation

      // Check if today already exists in log, update instead of adding duplicate
      let todayLogIndex = updatedLog.findIndex(log => log.date === today);
      if (todayLogIndex !== -1) {
          updatedLog[todayLogIndex].pagesRead += pagesRead; // Aggregate pages read for today
      } else {
          updatedLog.unshift({ date: today, pagesRead }); // Add new entry for today
      }

      // 🔥 **Ensure we only keep logs within 90 days**
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      // ✅ Remove outdated logs from Firestore
      updatedLog = updatedLog.filter(log => new Date(log.date) >= cutoffDate);
      journalLogs = journalLogs.filter(log => new Date(log.date) >= cutoffDate);

      console.log(`🔥 Deleted logs older than 90 days from Firestore. Remaining logs:`, updatedLog);

      // 🔄 Update Firestore
      await updateDoc(entryDocRef, {
          currentPage: newCurrentPage,
          updatedAt: new Date(),
          pagesRead: pagesRead,
          journalLogs: journalLogs
      });

      await setDoc(summaryDocRef, {
          mostRecent: entryDocSnap.data().title,
          updatedAt: new Date(),
          streak: streak,
          streakDate: streakDate,
          readingLog: updatedLog
      }, { merge: true });

      console.log(`✅ Updated streak to ${streak} days, streakDate: ${streakDate}`);
      console.log("📊 Updated reading log for timeline chart:", updatedLog);

      // ✅ Ensure UI updates properly
      if (viewingPublication && viewingPublication.id === entryId) {
          viewingPublication.journalLogs = journalLogs;
          viewingPublication.currentPage = newCurrentPage;
      }

      // Calculate if reading is complete (100%)
      const publication = entryDocSnap.data();
      const progress = Math.round(((newCurrentPage - publication.pageStart) / (publication.pageEnd - publication.pageStart)) * 100);

      // If reading is complete, show rating dialog
      if (progress >= 100) {
          showRatingDialog(entryId, publication.title);
      }

      await loadUserLibrary();
      currentStreak.set(streak); // Update UI Streak using store's set method

      // ✅ Trigger Timeline Chart and Progress Chart Re-render
      chartRefreshKey.update(n => n + 1);
      chartKey.update(n => n + 1);

  } catch (error) {
      console.error("❌ Error updating progress:", error.message);
  }
}


// Rating variables
let ratingDialogOpen = false;
let currentRating = 0;
let publicationToRate = null;
let publicationTitleToRate = "";

// Show rating dialog
function showRatingDialog(pubId, pubTitle) {
  publicationToRate = pubId;
  publicationTitleToRate = pubTitle;
  currentRating = 0;
  ratingDialogOpen = true;
}

// Save rating to Storage
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
          }
      }

      // Update Firestore
      ratingsData[currentRating] = (ratingsData[currentRating] || 0) + 1;

      await Promise.all([
          setDoc(libraryRef, { rating: currentRating }, { merge: true }), // Update publication rating
          setDoc(ratingsDocRef, ratingsData, { merge: true }) // Update overall ratings count
      ]);

      console.log(`✅ Rating of ${currentRating} saved for publication ${publicationToRate}`);

      // ✅ Update UI
      libraryList = libraryList.map(entry => entry.id === publicationToRate ? { ...entry, rating: currentRating } : entry);
      ratingDialogOpen = false;

      // ✅ Refresh charts
      chartKey.update(n => n + 1);
  } catch (error) {
      console.error("❌ Error saving rating:", error.message);
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
      console.log("📊 Starting full chart refresh...");
      const userDocRef = doc(firestore, "users", user.uid);
      const chartsCollectionRef = collection(userDocRef, "charts");
      const batch = writeBatch(firestore);

      let tagsCount = {};
      let authorsCount = {};
      let mostRecentTitle = null;
      let latestLogTime = null;

      // 🔍 Fetch all current publications from the library
      const libraryRef = collection(userDocRef, "library");
      const librarySnapshot = await getDocs(libraryRef);

      if (librarySnapshot.empty) {
          console.warn("⚠️ No publications found. Resetting charts.");
          batch.set(doc(chartsCollectionRef, "tags"), {}, { merge: false });
          batch.set(doc(chartsCollectionRef, "authors"), {}, { merge: false });
          batch.set(doc(chartsCollectionRef, "summary"), { mostRecent: null, updatedAt: new Date() }, { merge: true });

          await batch.commit();
          return;
      }

      // 🔄 Recalculate authors, tags, and find most recently logged book
      librarySnapshot.forEach(docSnap => {
          const entry = docSnap.data();
          const { tags, author, journalLogs, title } = entry;

          // Count tags
          if (tags && Array.isArray(tags)) {
              tags.forEach(tag => {
                  if (typeof tag === "string") {
                      tagsCount[tag] = (tagsCount[tag] || 0) + 1;
                  } else {
                      console.warn("❌ Invalid tag:", tag);
                  }
              });
          }

          // Count authors
          if (author) {
              authorsCount[author] = (authorsCount[author] || 0) + 1;
          }

          // Check if this book has logs
          if (journalLogs && journalLogs.length > 0) {
              const lastLog = journalLogs[journalLogs.length - 1]; // Get most recent log
              const logDate = new Date(lastLog.date);

              if (!latestLogTime || logDate > latestLogTime) {
                  mostRecentTitle = title;
                  latestLogTime = logDate;
              }
          }
      });

      console.log("📊 Final Tag Counts:", tagsCount);
      console.log("✍️ Final Author Counts:", authorsCount);
      console.log("📌 Most Recent Book (with logs):", mostRecentTitle);

      // ✅ Save the recalculated data to Firestore
      batch.set(doc(chartsCollectionRef, "tags"), tagsCount, { merge: true });
      batch.set(doc(chartsCollectionRef, "authors"), authorsCount, { merge: true });
      batch.set(doc(chartsCollectionRef, "summary"), { mostRecent: mostRecentTitle, updatedAt: new Date() }, { merge: true });

      await batch.commit();
      console.log("✅ Charts updated successfully!");

      // ✅ Trigger UI update
      chartKey.update(n => n + 1);

  } catch (error) {
      console.error("❌ Error updating charts:", error.message);
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
    if (title && author && pageStart && pageEnd && pageEnd >= pageStart) { // Remove isbn from required fields
        const newEntry = {
            title,
            author,
            isbn: isbn || "", // Make ISBN/DOI optional
            pageStart,
            pageEnd,
            currentPage: pageStart,
            comment,
            tags: Array.isArray(tags) ? tags.map(tag => tag.trim()) : [],
            journalLogs: [],
        };

        console.log("📌 Saving entry with tags:", newEntry.tags);

        await saveEntryToFirestore(newEntry);
        await loadUserLibrary();
        await updateCharts();  // ✅ Refresh charts
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

      // 🔍 Fetch the existing data before update
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
          pageStart,
          pageEnd,
          currentPage,
          tags: Array.isArray(tags) ? tags.map(tag => tag.trim()) : [],
          updatedAt: new Date()
      };

      // ✅ Save updated publication data
      await updateDoc(entryDocRef, updatedData);
      console.log(`✅ Updated publication: ${editingPublication.id}`);

      // Update charts after editing
      await updateChartsAfterEdit(user.uid, oldData, updatedData);

      // ✅ Trigger a UI reactivity update
      libraryList = [...libraryList];

      // ✅ Refresh charts so the tags/authors are fully rebuilt
      await updateCharts();

      // ✅ Update `libraryList` in-memory so the UI updates
      libraryList = libraryList.map(entry =>
          entry.id === editingPublication.id ? { ...entry, ...updatedData } : entry
      );

      closeModal();

  } catch (error) {
      console.error("❌ Error updating publication:", error.message);
  }
}

async function updateChartsAfterEdit(userId, oldData, newData) {
    const userDocRef = doc(firestore, "users", userId);
    const chartsCollectionRef = collection(userDocRef, "charts");

    try {
        // 🔄 Update Authors
        const authorsDocRef = doc(chartsCollectionRef, "authors");
        const authorsSnap = await getDoc(authorsDocRef);
        let authorsData = authorsSnap.exists() ? authorsSnap.data() : {};

        // Remove old author if different from the new one
        if (oldData.author && oldData.author !== newData.author) {
            if (authorsData[oldData.author]) {
                authorsData[oldData.author] -= 1;
                if (authorsData[oldData.author] <= 0) delete authorsData[oldData.author];
            }
        }

        // Add new author
        if (newData.author) {
            authorsData[newData.author] = (authorsData[newData.author] || 0) + 1;
        }

        await setDoc(authorsDocRef, authorsData, { merge: false });

        // 🔄 Update Tags
        const tagsDocRef = doc(chartsCollectionRef, "tags");
        const tagsSnap = await getDoc(tagsDocRef);
        let tagsData = tagsSnap.exists() ? tagsSnap.data() : {};

        // Remove tags that are no longer associated
        const oldTags = new Set(oldData.tags || []);
        const newTags = new Set(newData.tags || []);

        oldTags.forEach(tag => {
            if (!newTags.has(tag)) {
                if (tagsData[tag]) {
                    tagsData[tag] -= 1;
                    if (tagsData[tag] <= 0) delete tagsData[tag];
                }
            }
        });

        // Add new tags or update existing ones
        newData.tags.forEach(tag => {
            tagsData[tag] = (tagsData[tag] || 0) + 1;
        });

        await setDoc(tagsDocRef, tagsData, { merge: false });

        console.log("✅ Charts updated after edit");
    } catch (error) {
        console.error("❌ Error updating charts after edit:", error.message);
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
      isbn = result.isbn || ""; // Make ISBN/DOI optional
      if (result.doi) {
          isbn = result.doi; // Also assign DOI to the isbn field if available
      }
      pageStart = 1;
      pageEnd = result.pageEnd !== "Unknown Pages" ? result.pageEnd : 1;
      currentPage = 1;
      showResults = false; // Hide the search results dropdown after selection

      console.log(`Selected book: ${title}, ISBN/DOI: ${isbn}, Total Pages: ${pageEnd}`);
  }

  async function deletePublication(publicationId) {
  const user = auth.currentUser;
  if (!user) {
      console.error("No authenticated user found.");
      return;
  }

  console.log("🗑 Deleting publication:", publicationId);

  const confirmDelete = confirm("Are you sure you want to delete this publication?");
  if (!confirmDelete) return;

  try {
      const userDocRef = doc(firestore, "users", user.uid);
      const entryDocRef = doc(userDocRef, "library", publicationId);
      const summaryDocRef = doc(collection(userDocRef, "charts"), "summary");

      // Fetch publication before deletion
      const entryDocSnap = await getDoc(entryDocRef);
      if (!entryDocSnap.exists()) {
          console.warn("Publication not found.");
          return;
      }

      const oldData = entryDocSnap.data();

      const deletedTitle = entryDocSnap.data().title;
      const author = entryDocSnap.data().author;
      const tags = entryDocSnap.data().tags || [];
      const deletedRating = entryDocSnap.data().rating || null; // Get the rating of the deleted publication

      await deleteDoc(entryDocRef);
      console.log(`✅ Deleted publication: ${deletedTitle}`);

      // Update charts after deletion
      await updateChartsAfterEdit(user.uid, oldData, {});

      // ✅ Remove from UI state
      libraryList = libraryList.filter(entry => entry.id !== publicationId);
      libraryList = [...libraryList];

      // ✅ Recalculate most recent book
      let newMostRecentTitle = null;
      let latestLogTime = null;

      const libraryRef = collection(userDocRef, "library");
      const q = query(libraryRef, orderBy("updatedAt", "desc"));
      const querySnapshot = await getDocs(q);

      querySnapshot.forEach(docSnap => {
          const entry = docSnap.data();
          if (entry.journalLogs && entry.journalLogs.length > 0) {
              const lastLog = entry.journalLogs[entry.journalLogs.length - 1];
              const logDate = new Date(lastLog.date);

              if (!latestLogTime || logDate > latestLogTime) {
                  newMostRecentTitle = entry.title;
                  latestLogTime = logDate;
              }
          }
      });

      // ✅ Save updated mostRecent book
      await setDoc(summaryDocRef, { mostRecent: newMostRecentTitle, updatedAt: new Date() }, { merge: true });

      console.log(`📌 Updated mostRecent book to: ${newMostRecentTitle}`);

      // ✅ Update Author & Tag Counts in Firestore, and deduct rating count
      await updateChartsAfterDeletion(user.uid, author, tags, deletedTitle, deletedRating);

      // ✅ Refresh UI
      await updateCharts();

      // 🔥 **Force Pie Chart & Ratings Chart Re-Rendering**
      chartKey.update(n => n + 1); 

  } catch (error) {
      console.error("❌ Error deleting publication:", error.message);
  }
}

async function updateChartsAfterDeletion(userId, author, tags, deletedTitle, deletedRating) {
    try {
        console.log("🚀 Starting updateChartsAfterDeletion...");
        const userDocRef = doc(firestore, "users", userId);
        const chartsCollectionRef = collection(userDocRef, "charts");
        const batch = writeBatch(firestore);

        // --- Update author count ---
        console.log("📊 Updating author counts...");
        const authorDocRef = doc(chartsCollectionRef, "authors");
        const authorDocSnap = await getDoc(authorDocRef);
        if (authorDocSnap.exists()) {
            const authorData = authorDocSnap.data();
            if (authorData[author]) {
                authorData[author] -= 1;
                if (authorData[author] <= 0) {
                    delete authorData[author];
                }
                batch.set(authorDocRef, authorData, { merge: false });
            }
        }

        // --- Update tag counts ---
        console.log("🏷️ Updating tag counts...");
        const tagsDocRef = doc(chartsCollectionRef, "tags");
        const tagsDocSnap = await getDoc(tagsDocRef);
        if (tagsDocSnap.exists()) {
            const tagData = tagsDocSnap.data();
            tags.forEach(tag => {
                if (tagData[tag]) {
                    tagData[tag] -= 1;
                    if (tagData[tag] <= 0) {
                        delete tagData[tag];
                    }
                }
            });
            batch.set(tagsDocRef, tagData, { merge: false });
        }

        // --- Update ratings count ---
        if (deletedRating) {
            console.log("⭐ Updating rating counts...");
            const ratingsDocRef = doc(chartsCollectionRef, "ratings");
            const ratingsSnap = await getDoc(ratingsDocRef);
            if (ratingsSnap.exists()) {
                const ratingsData = ratingsSnap.data();
                const ratingKey = String(deletedRating); // Ensure it matches Firestore's string key format

                if (ratingsData[ratingKey]) {
                    ratingsData[ratingKey] -= 1;

                    // If the count becomes zero, set it to null or delete the field entirely
                    if (ratingsData[ratingKey] <= 0) {
                        delete ratingsData[ratingKey];
                    }

                    batch.set(ratingsDocRef, ratingsData, { merge: false });
                    console.log(`✅ Updated rating ${ratingKey} count:`, ratingsData[ratingKey]);
                }
            }
        }


        // --- Check and update "mostRecent" ---
        console.log("📌 Checking mostRecent...");
        const mostRecentDocRef = doc(chartsCollectionRef, "summary");
        const mostRecentDocSnap = await getDoc(mostRecentDocRef);
        let isMostRecentDeleted = false;

        if (mostRecentDocSnap.exists()) {
            const mostRecentData = mostRecentDocSnap.data();
            if (mostRecentData.mostRecent === deletedTitle) {
                isMostRecentDeleted = true;
            }
        }

        if (isMostRecentDeleted) {
            console.log(`🛑 Deleted title "${deletedTitle}" was the most recent. Finding a new most recent...`);

            const libraryRef = collection(userDocRef, "library");
            const q = query(libraryRef, orderBy("updatedAt", "desc"), limit(1));
            const querySnapshot = await getDocs(q);

            let newMostRecentTitle = "None";
            if (!querySnapshot.empty) {
                newMostRecentTitle = querySnapshot.docs[0].data().title;
            }

            console.log(`📌 New most recent title: ${newMostRecentTitle}`);

            batch.set(mostRecentDocRef, { mostRecent: newMostRecentTitle, updatedAt: new Date() }, { merge: false });
            console.log("📝 Added mostRecent update to batch.");
        } else {
            console.log(`✅ Deleted title "${deletedTitle}" was NOT the most recent. No update needed.`);
        }

        // Finalize batch update
        console.log("🛠️ Final batch object before commit:", batch);
        await batch.commit();
        console.log("✅ Charts and most recent literature updated successfully.");

    } catch (error) {
        console.error("❌ Error updating charts after deletion:", error.message);
    }
}



  function handleCardClick(event, lit) {
      // Check if the click originated from a button or dropdown/popover trigger
      const isButtonClick = event.target.closest('button') || event.target.closest('[role="button"]');
      if (!isButtonClick) {
          openViewModal(lit);
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
              <ChevronsUpDown class="w-4 h-4 text-neutral-800" />
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

    <!-- Header Area -->
    <div class="pt-12 px-12 flex justify-between items-center">
      <h2 class="text-4xl font-bold text-neutral-800">Welcome, {firstName}!</h2>
      <div class="flex space-x-4">
        <Button class="bg-white hover:bg-neutral-300 text-neutral-800" on:click={openLogReadingModal}>
          <BookOpen class="w-5 h-5 mr-2" /> Log Reading
        </Button>
        
        <Button class="bg-blue-600 hover:bg-blue-700" on:click={openAddModal}>
          <FilePlus2 class="w-4 h-4 mr-2" /> New Publication
        </Button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex flex-1">
      <!-- Publications Section -->
      <section class="w-1/2 py-12 pl-12 pr-3 flex flex-col">
        <div class="bg-white border border-neutral-300 rounded-lg shadow flex-1 flex flex-col">
          <div class="p-4 border-b border-neutral-200">
            <h2 class="text-xl font-semibold flex justify-between items-center text-neutral-700">
              <div class="flex items-center">
                <Clock class="w-5 h-5 mr-2 text-neutral-600" />
                Recently Accessed
              </div>
              <Button class="text-sm" variant="outline" on:click={() => navigate("/library")}>
                View all
              </Button>
            </h2>
          </div>

          {#if libraryList.length === 0}
            <div class="flex flex-col items-center justify-center text-center text-gray-500 py-12 flex-1">
              <p class="text-lg font-medium">No literature added yet.</p>
              <p class="text-sm mt-2">Start by adding a new publication to track your progress!</p>
            </div>
          {:else}
            <ul class="divide-y divide-neutral-200 flex-1">
              {#each libraryList as lit, i}
                {#if i < 5}
                  <li class="p-4 hover:bg-neutral-50">
                    <div class="flex justify-between items-start">
                      <button 
                        class="text-left flex-1" 
                        on:click={() => openViewModal(lit)}
                        on:keydown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            openViewModal(lit);
                          }
                        }}
                      >
                        <h3 class="font-medium text-neutral-900">{lit.title}</h3>
                        <p class="text-sm text-neutral-500">{lit.author}</p>
                        
                        {#if lit.tags?.length > 0}
                          <div class="flex flex-wrap gap-1 mt-2">
                            {#each lit.tags as tag}
                              <span class="bg-blue-100 text-blue-800 px-2 py-0.5 text-xs rounded-full">{tag}</span>
                            {/each}
                          </div>
                        {/if}
                      </button>
                      
                      <div class="flex items-center space-x-2">
                        <!-- Log Reading Button -->
                        <Button 
                          size="sm" 
                          variant="outline" 
                          class="gap-2" 
                          on:click={() => {
                            // Set up the current publication for logging
                            lit.newCurrentPage = lit.currentPage || lit.pageStart;
                            lit.progressComment = "";
                            lit.isUpdating = true;
                          }}
                        >
                          <BookOpen class="w-5 h-5" />
                          <span>Log Reading</span>
                        </Button>
                        
                        <!-- Menu Button -->
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger>
                            <Button size="icon" variant="ghost">
                              <MoreVertical class="h-4 w-4" />
                            </Button>
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
                    
                    <!-- Progress Section -->
                    <button 
                      class="w-full mt-3 text-left"
                      on:click={() => openViewModal(lit)}
                      on:keydown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          openViewModal(lit);
                        }
                      }}
                    >
                      <div class="flex justify-between text-xs text-neutral-500 mb-1">
                        <span>
                          {Math.min(100, Math.round(((lit.currentPage || lit.pageStart) - lit.pageStart) / (lit.pageEnd - lit.pageStart) * 100))}% Complete
                        </span>
                        <span>
                          {lit.currentPage || lit.pageStart} of {lit.pageEnd} pages
                        </span>
                      </div>
                      <Progress value={Math.min(100, Math.round(((lit.currentPage || lit.pageStart) - lit.pageStart) / (lit.pageEnd - lit.pageStart) * 100))} />
                    </button>
                    
                    <!-- Log Reading Popover -->
                    {#if lit.isUpdating}
                      <Dialog.Root open={lit.isUpdating}>
                        <Dialog.Content class="w-[400px]">
                          <Dialog.Header>
                            <Dialog.Title>Update Reading Progress</Dialog.Title>
                            <Dialog.Description>
                              Update your reading progress for "{lit.title}"
                            </Dialog.Description>
                          </Dialog.Header>
                          <div class="p-4">
                            <div class="space-y-4">
                              <div>
                                <label for="current-page-{lit.id}" class="block text-sm font-medium text-neutral-700 mb-1">
                                  Current Page:
                                </label>
                                <input 
                                  id="current-page-{lit.id}"
                                  type="number" 
                                  min={lit.pageStart} 
                                  max={lit.pageEnd} 
                                  bind:value={lit.newCurrentPage} 
                                  class="w-full p-2 border rounded border-neutral-300 shadow-sm" 
                                />
                              </div>
                              <div>
                                <label for="comment-{lit.id}" class="block text-sm font-medium text-neutral-700 mb-1">
                                  Comment:
                                </label>
                                <textarea 
                                  id="comment-{lit.id}"
                                  bind:value={lit.progressComment} 
                                  class="w-full p-2 border rounded border-neutral-300 shadow-sm" 
                                  placeholder="Add a note about your reading progress"
                                  rows="3"
                                ></textarea>
                              </div>
                            </div>
                            <div class="flex justify-end mt-6 space-x-2">
                              <Button 
                                variant="outline" 
                                on:click={() => {
                                  lit.isUpdating = false;
                                }}
                              >
                                Cancel
                              </Button>
                              <Button 
                                on:click={async () => {
                                  await updateProgress(lit.id, lit.newCurrentPage, lit.pageStart, lit.progressComment);
                                  lit.isUpdating = false;
                                }} 
                                class="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                Save Progress
                              </Button>
                            </div>
                          </div>
                        </Dialog.Content>
                      </Dialog.Root>
                    {/if}
                  </li>
                {/if}
              {/each}
            </ul>
          {/if}
        </div>
      </section>

      <!-- Analytics Section -->
      <section class="w-1/2 py-12 pl-3 pr-12 flex flex-col">
        <div class="grid grid-cols-5 gap-4 flex-1">
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
              <TimelineChart selectedRange={$selectedTimeline} chartRefreshKey={$chartRefreshKey} />
            </div>
          </div>
          <div class="col-span-2 p-6 h-72 bg-white border border-neutral-300 rounded-md shadow flex flex-col items-center justify-center">
            <p class="text-lg font-semibold text-neutral-800">Current Streak</p>
            <p class="text-5xl font-bold text-blue-500 mt-2">{$currentStreak}</p>
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
              <PieChart type={$selectedPieChart} chartKey={$chartKey} />
            </div>
          </div>
          <!-- Progress Section -->
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

            <!-- Display progress percentage -->
            <div class="text-center mb-3">
              <p class="text-4xl font-bold text-blue-600">{$progressPercentage}%</p>
              <p class="text-sm text-gray-500">of total reading completed</p>
            </div>

            <!-- Progress Chart (Calculates but does NOT display) -->
            <ProgressChart selectedView={$selectedProgress} updateProgress={val => progressPercentage.set(val)} chartKey={$chartRefreshKey} />

            <!-- Simple Progress Bar -->
            <div class="relative w-full h-6 bg-gray-200 rounded-full">
              <div class="absolute top-0 left-0 h-6 bg-blue-500 rounded-full transition-all" style="width: {$progressPercentage}%;"></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
{/if}

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

<!-- Log Reading Modal -->
<Dialog.Root bind:open={logReadingModalOpen}>
  <Dialog.Content class="w-[500px]">
    <Dialog.Header>
      <Dialog.Title>Log Your Reading</Dialog.Title>
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
              {#if libraryList.length === 0}
                <option value="" disabled>No publications available</option>
              {:else}
                {#each libraryList as pub}
                  <option value={pub.id}>{pub.title}</option>
                {/each}
              {/if}
            </select>
          </div>

          <!-- Current Page Input -->
          <div class="space-y-2">
            <label for="current-page" class="block text-sm font-medium">
              Current Page
            </label>
            <input id="current-page" type="number" bind:value={logReadingNewPage} 
              class="w-full p-2 border border-neutral-300 rounded"
              min={libraryList.find(p => p.id === logReadingPublication)?.pageStart || 1}
              max={libraryList.find(p => p.id === logReadingPublication)?.pageEnd || 1000} />
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
              Save Reading
            </Button>
          </div>
        </form>
      </Dialog.Description>
    </Dialog.Header>
  </Dialog.Content>
</Dialog.Root>

<!-- New Publication Dialog -->
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
                on:keydown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    searchLiterature();
                  }
                }}
                class="w-full pl-4 pr-16 py-4 text-neutral-700 rounded-full border border-neutral-300 focus:ring-blue-500 focus:border-blue-500 shadow-sm placeholder-neutral-400"
                placeholder="Search by DOI, ISBN, or Title" 
                autocomplete="off" 
              />
              <button 
                class="absolute inset-y-0 right-0 px-4 flex items-center rounded-r-full bg-blue-500 hover:bg-blue-600 text-white"
                on:click={searchLiterature}
              >
                {#if isSearching}
                  <div class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {:else}
                  <Search class="w-6 h-6" />
                {/if}
              </button>
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
              <label for="isbn-doi" class="w-1/4 text-sm font-medium text-neutral-700">ISBN/DOI</label>
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
                class="flex-1 p-1.5 pl-2 border rounded-md border-neutral-300"></textarea>
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

<!-- View Publication Dialog -->
<Dialog.Root bind:open={viewModalOpen}>
  <Dialog.Content class="w-[300px] max-w-[60%] max-h-[80vh] overflow-y-auto bg-white">
      <div class="flex justify-between items-start mb-2">
          <div>
              <Dialog.Title class="text-2xl font-bold">
                  {viewingPublication?.title || "Publication Details"}
              </Dialog.Title>
              <p class="text-neutral-600 mt-1">
                  {viewingPublication?.author || ""}
              </p>
          </div>
      </div>
      
      <Dialog.Description class="mt-4">
          {#if viewingPublication}
              <div class="flex items-center gap-2 mb-4">
                  <Book class="w-5 h-5 text-neutral-600" />
                  <span class="text-neutral-700">
                      {viewingPublication.currentPage || viewingPublication.pageStart} / {viewingPublication.pageEnd} pages
                  </span>
              </div>
              
              <!-- Progress Bar -->
              <div class="mb-6">
                  <div class="h-2 bg-blue-100 rounded-full mb-1">
                      <div class="h-2 bg-black rounded-full" style="width: {Math.min(100, Math.round(((viewingPublication.currentPage || viewingPublication.pageStart) - viewingPublication.pageStart) / (viewingPublication.pageEnd - viewingPublication.pageStart) * 100))}%"></div>
                  </div>
                  <div class="text-sm text-neutral-600">
                      {Math.min(100, Math.round(((viewingPublication.currentPage || viewingPublication.pageStart) - viewingPublication.pageStart) / (viewingPublication.pageEnd - viewingPublication.pageStart) * 100))}% complete
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
                      <Button 
                        class="flex items-center gap-2" 
                        variant="outline"
                        on:click={() => {
                          logReadingPublication = viewingPublication.id;
                          logReadingNewPage = viewingPublication.currentPage || viewingPublication.pageStart;
                          logReadingComment = "";
                          logReadingModalOpen = true;
                          viewModalOpen = false; // Close the view modal when opening the log modal
                        }}
                      >
                          <BookOpen class="w-5 h-5" />
                          Log Reading
                      </Button>
                  </div>
                  
                  {#if viewingPublication.journalLogs?.length > 0}
                      <div class="space-y-4">
                          {#each viewingPublication.journalLogs as log}
                              <div class="bg-white border border-neutral-300 rounded-lg p-4">
                                  <div class="flex justify-between mb-2">
                                      <div class="flex items-center gap-2 text-neutral-600">
                                          <Calendar class="w-4 h-4" />
                                          <span>{new Date(log.date).toLocaleDateString()}</span>
                                      </div>
                                  </div>
                                  
                                  <div class="flex items-center gap-2 mb-2 text-neutral-600">
                                      <Book class="w-4 h-4" />
                                      <span>{log.pagesRead} pages</span>
                                  </div>
                                  
                                  <div class="mb-3">
                                      <div class="h-2 bg-blue-100 rounded-full">
                                          <div class="h-2 bg-black rounded-full" style="width: {Math.round(((log.toPage) - viewingPublication.pageStart) / (viewingPublication.pageEnd - viewingPublication.pageStart) * 100)}%"></div>
                                      </div>
                                      <div class="text-xs text-neutral-600 mt-1">
                                          Progress at this point: {Math.round(((log.toPage) - viewingPublication.pageStart) / (viewingPublication.pageEnd - viewingPublication.pageStart) * 100)}%
                                      </div>
                                  </div>
                                  
                                  {#if log.comment}
                                      <p class="text-neutral-700 bg-neutral-50 p-3 rounded-md">{log.comment}</p>
                                  {/if}
                              </div>
                          {/each}
                      </div>
                  {:else}
                      <div class="text-center p-6 bg-neutral-50 rounded-lg">
                          <p class="text-neutral-500">No reading logs yet.</p>
                          <p class="text-sm text-neutral-400 mt-1">Start tracking your progress by clicking "Log Reading".</p>
                      </div>
                  {/if}
              </div>
          {/if}
      </Dialog.Description>
  </Dialog.Content>
</Dialog.Root>