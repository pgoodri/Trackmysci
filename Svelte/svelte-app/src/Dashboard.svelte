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
    limit as firebaseLimit
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
    Percent,
    BookMarked,
    Timer,
    TrendingUp,
    Plus,
    BarChart,
    ClipboardList,
    Flame,
    PieChart as PieChartIcon
  } from "lucide-svelte";
  import { Chart } from "chart.js/auto";
  import { onMount } from "svelte";
  import TagsChart from "./lib/components/ui/charts/TagsChart.svelte";
  import RatingsChart from "./lib/components/ui/charts/RatingsChart.svelte";
  import ProgressChart from "./lib/components/ui/charts/ProgressChart.svelte";
  import TimelineChart from "./lib/components/ui/charts/TimelineChart.svelte";
  import PieChart from "./lib/components/ui/charts/PieChart.svelte";
  import StreakChart from "./lib/components/ui/charts/StreakChart.svelte";

  // Stores for data and UI
  let chartKey = writable(0); // Used to force chart re-render
  let chartRefreshKey = writable(0);
  let currentStreak = writable(0); // Initialize streak to 0
  const batch = writeBatch(firestore);

  let isSearching = false; // Add this for spinner state
  
  // Constant for primary color
  const PRIMARY_COLOR = "#4361ee";

  // Track today's reading metrics
  let todayStats = {
    pagesRead: 0,
    readingTime: 0,
    pagesPerHour: 0,
    weeklyPages: 0,
    weeklyHours: 0
  };
  
  function calculateReadingMetrics() {
    if (!libraryList || libraryList.length === 0) return;
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Calculate yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toISOString().split('T')[0];
    
    // Calculate a week ago
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoString = weekAgo.toISOString().split('T')[0];
    
    let todayPages = 0;
    let todayMinutes = 0;
    let yesterdayPages = 0;
    let weeklyPages = 0;
    let weeklyMinutes = 0;
    
    // Calculate metrics from all reading sessions
    libraryList.forEach(pub => {
      if (pub.readingSessions && pub.readingSessions.length > 0) {
        pub.readingSessions.forEach(session => {
          const sessionDate = new Date(session.date).toISOString().split('T')[0];
          
          // Today's metrics
          if (sessionDate === today) {
            todayPages += session.pagesRead || 0;
            todayMinutes += session.duration || 0;
          }
          
          // Yesterday's metrics
          if (sessionDate === yesterdayString) {
            yesterdayPages += session.pagesRead || 0;
          }
          
          // Weekly metrics
          if (sessionDate >= weekAgoString) {
            weeklyPages += session.pagesRead || 0;
            weeklyMinutes += session.duration || 0;
          }
        });
      }
    });
    
    // Convert minutes to hours
    const todayHours = todayMinutes / 60;
    const weeklyHours = weeklyMinutes / 60;
    
    // Calculate progress from yesterday
    const progressFromYesterday = todayPages > 0 && yesterdayPages > 0 
      ? todayPages - yesterdayPages 
      : 0;
    
    // Update the metrics object
    todayStats = {
      pagesRead: todayPages,
      readingTime: todayHours.toFixed(1),
      pagesPerHour: todayHours > 0 ? (todayPages / todayHours).toFixed(1) : 0,
      weeklyPages: weeklyPages,
      weeklyHours: weeklyHours.toFixed(1),
      yesterdayPages: yesterdayPages,
      progressFromYesterday: progressFromYesterday
    };
  }

  // Days of the week for streak visualization
  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  onMount(() => {
    // Initialize properties for each publication in the library list
    if (libraryList && libraryList.length > 0) {
      libraryList.forEach(lit => {
        lit.progressComment = "";
        lit.isUpdating = false;
        lit.pagesRead = 0;
        lit.duration = 0;
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
      
      searchResults = [
        {
          title: bookData.title || "Unknown Title",
          author: bookData.authors
            ? bookData.authors.map((a) => a.name).join(", ")
            : "Unknown Author",
          isbn: isbn
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
      console.log("Final Search Results (Title):", searchResults);
    } catch (error) {
      console.error("Error fetching title data:", error);
      alert("Failed to retrieve title information.");
    }
  }

  async function fetchISBNFromEditions(workKey) {
    try {
      console.log("Fetching ISBN from editions for:", workKey);
      const response = await fetch(`https://openlibrary.org${workKey}/editions.json`);
      const data = await response.json();
      console.log("Editions Data:", data);
      if (data.entries && data.entries.length > 0) {
        for (const entry of data.entries) {
          let isbn = entry.isbn_10 ? entry.isbn_10[0] : entry.isbn_13 ? entry.isbn_13[0] : null;
          if (isbn) {
            return { isbn };
          }
        }
      }
      console.warn("No ISBN found in editions for:", workKey);
      return { isbn: null };
    } catch (error) {
      console.error("Error fetching ISBN from editions:", error);
      return { isbn: null };
    }
  }

  // Stores for selected chart options
  let selectedPieChart = writable("Tags");
  let selectedTimeline = writable("30 Days");
  let selectedProgress = writable("All Publications");
  let progressPercentage = writable(0); // Initially 0, will update dynamically

  const pieChartOptions = ["Tags", "Ratings", "Authors"];
  const timelineOptions = ["30 Days", "60 Days", "90 Days"];
  const progressOptions = ["All Publications", "Reading Status"];

  // Variables for progress updates
  let progressComment = "";

  // Publication management variables
  let searchQuery = "";
  let title = "";
  let author = "";
  let isbn = "";
  let comment = "";
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
  let editMode = false;
  let editingPublication = null;

  let viewingPublication = null;  // Will store the entire publication object
  let viewModalOpen = false;      // Controls if the "view publication details" modal is open

  // Log Reading modal variables
  let logReadingModalOpen = false;
  let logReadingPublication = null;
  let logReadingPagesRead = 0;
  let logReadingComment = "";
  let logReadingDuration = 0;
  
  
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
    }
    logReadingPagesRead = 0;
    logReadingComment = "";
    logReadingDuration = 0;
    logReadingModalOpen = true;
  }

  // Function to save reading log via modal
  async function saveReadingLog() {
    if (!logReadingPublication || !logReadingPagesRead) return;
    
    const publication = libraryList.find(p => p.id === logReadingPublication);
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
    tags = pub.tags || [];
    modalOpen = true;
  }

    function closeModal() {
      console.log("Closing modal...");
      modalOpen = false;
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
      
      // Calculate reading metrics based on loaded library data
      calculateReadingMetrics();
  } catch (error) {
      console.error("❌ Error loading library:", error.message);
  }
}


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
              streak = 1; // Reset to 1 since user is reading today
              streakDate = today;
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
      
      // Keep reading sessions for all time
      console.log(`🔥 Deleted logs older than 90 days from Firestore. Remaining logs:`, updatedLog);

      // Update publication status if not already marked as complete
      const entryData = entryDocSnap.data();
      let status = entryData.status || "unread";
      if (status === "unread" && !entryData.completed) {
          status = "in progress";
      }

      // 🔄 Update Firestore
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

      console.log(`✅ Updated streak to ${streak} days, streakDate: ${streakDate}`);
      console.log("📊 Updated reading log for timeline chart:", updatedLog);

      // ✅ Ensure UI updates properly
      if (viewingPublication && viewingPublication.id === entryId) {
          viewingPublication.readingSessions = readingSessions;
          viewingPublication.totalPagesRead = (viewingPublication.totalPagesRead || 0) + pagesRead;
          viewingPublication.status = status;
      }

      await loadUserLibrary();
      currentStreak.set(streak); // Update UI Streak using store's set method

      // ✅ Trigger Timeline Chart and Progress Chart Re-render
      chartRefreshKey.update(n => n + 1);
      chartKey.update(n => n + 1);
      
      // Recalculate reading metrics after updating session data
      calculateReadingMetrics();

  } catch (error) {
      console.error("❌ Error updating progress:", error.message);
  }
}


// Rating variables
let ratingDialogOpen = false;
let currentRating = 0;
let publicationToRate = null;
let publicationTitleToRate = "";
let markCompletedWithRating = false;

// Show rating dialog
function showRatingDialog(pubId, pubTitle) {
  publicationToRate = pubId;
  publicationTitleToRate = pubTitle;
  currentRating = 0;
  ratingDialogOpen = true;
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
        const publication = libraryList.find(p => p.id === publicationId);
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
        
        // Update UI
        libraryList = libraryList.map(entry => 
            entry.id === publicationId 
            ? { 
                ...entry, 
                completed: newStatus, 
                status: newStatus ? "completed" : 
                        (entry.readingSessions && entry.readingSessions.length > 0) 
                        ? "in progress" : "unread"
            } 
            : entry
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

// For backward compatibility
async function markAsCompleted(publicationId) {
    return toggleCompletionStatus(publicationId);
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
          const { tags, author, readingSessions, title } = entry;

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

          // Check if this book has reading sessions
          if (readingSessions && readingSessions.length > 0) {
              const lastSession = readingSessions[readingSessions.length - 1]; // Get most recent session
              const sessionDate = new Date(lastSession.date);

              if (!latestLogTime || sessionDate > latestLogTime) {
                  mostRecentTitle = title;
                  latestLogTime = sessionDate;
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
      
      // Check if the same title and author already exists
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
      console.log(`Added publication: "${newEntry.title}" by ${newEntry.author}`);
      libraryList = [newEntry, ...libraryList];
      resetFields();
      modalOpen = false;
    } catch (error) {
      console.error("Error saving entry:", error.message);
    }
  }

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

      const deletedPub = entryDocSnap.data();
      const deletedTitle = deletedPub.title;

      // Update UI first for better UX
      libraryList = libraryList.filter(lit => lit.id !== publicationId);

      // Delete the publication
      await deleteDoc(entryDocRef);
      console.log(`✅ Deleted publication: ${deletedTitle}`);

      // Close modal if open
      if (viewingPublication && viewingPublication.id === publicationId) {
          closeViewModal();
      }

      // Update charts and recent literature data
      await updateChartsAfterDeletion(user.uid, deletedPub);

  } catch (error) {
      console.error("❌ Error deleting publication:", error.message);
  }
}

async function updateChartsAfterDeletion(userId, deletedPub) {
    const userDocRef = doc(firestore, "users", userId);
    const chartsCollectionRef = collection(userDocRef, "charts");
    const batch = writeBatch(firestore);
    const deletedTitle = deletedPub.title;

    try {
        // 🔄 Update Authors
        const authorsDocRef = doc(chartsCollectionRef, "authors");
        const authorsSnap = await getDoc(authorsDocRef);
        let authorsData = authorsSnap.exists() ? authorsSnap.data() : {};

        if (deletedPub.author && authorsData[deletedPub.author]) {
            authorsData[deletedPub.author] -= 1;
            if (authorsData[deletedPub.author] <= 0) {
                delete authorsData[deletedPub.author];
            }
        }

        batch.set(authorsDocRef, authorsData, { merge: false });

        // 🔄 Update Tags
        const tagsDocRef = doc(chartsCollectionRef, "tags");
        const tagsSnap = await getDoc(tagsDocRef);
        let tagsData = tagsSnap.exists() ? tagsSnap.data() : {};

        if (deletedPub.tags && Array.isArray(deletedPub.tags)) {
            deletedPub.tags.forEach(tag => {
                if (tagsData[tag]) {
                    tagsData[tag] -= 1;
                    if (tagsData[tag] <= 0) {
                        delete tagsData[tag];
                    }
                }
            });
        }

        batch.set(tagsDocRef, tagsData, { merge: false });

        // 🔄 Check if we need to update "mostRecent" in summary
        const summaryDocRef = doc(chartsCollectionRef, "summary");
        const summarySnap = await getDoc(summaryDocRef);

        if (summarySnap.exists()) {
            const summaryData = summarySnap.data();
            if (summaryData.mostRecent === deletedTitle) {
                // Need to find new most recent book
                const libraryRef = collection(userDocRef, "library");
                const librarySnap = await getDocs(libraryRef);

                let newMostRecent = null;
                let latestDate = null;

                librarySnap.forEach(doc => {
                    const entry = doc.data();
                    if (entry.readingSessions && entry.readingSessions.length > 0) {
                        const lastSession = entry.readingSessions[entry.readingSessions.length - 1];
                        const sessionDate = new Date(lastSession.date);

                        if (!latestDate || sessionDate > latestDate) {
                            newMostRecent = entry.title;
                            latestDate = sessionDate;
                        }
                    }
                });

                batch.set(summaryDocRef, { mostRecent: newMostRecent, updatedAt: new Date() }, { merge: true });
                console.log(`🔄 Updating most recent title from "${deletedTitle}" to "${newMostRecent}"`);
            } else {
                console.log(`✅ Deleted title "${deletedTitle}" was NOT the most recent. No update needed.`);
            }
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

  // Function to format time (e.g., 2.5 hrs)
  function formatTime(hours) {
    return hours.toFixed(1) + ' hrs';
  }
  
  // Function to get recently read publications
  function getRecentlyReadPublications() {
    // Sort by most recent reading session
    return libraryList
      .filter(pub => pub.readingSessions && pub.readingSessions.length > 0)
      .sort((a, b) => {
        const aDate = new Date(a.readingSessions[a.readingSessions.length - 1].date);
        const bDate = new Date(b.readingSessions[b.readingSessions.length - 1].date);
        return bDate - aDate;
      })
      .slice(0, 3);
  }
  
  function logout() {
    signOut(auth)
      .then(() => {
        navigate("/login");
      })
      .catch((error) => {
        console.error("Error signing out:", error);
      });
  }
  
  // For calculating time since last reading session
  function getTimeSince(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60)) % 24;
    const diffMinutes = Math.floor(diffMs / (1000 * 60)) % 60;
    
    if (diffDays > 0) {
      return `${diffDays}d ago`;
    } else if (diffHours > 0) {
      return `${diffHours}h ago`;
    } else {
      return `${diffMinutes}m ago`;
    }
  }
  
  function selectResult(result) {
      title = result.title;
      author = result.author;
      isbn = result.isbn || ""; // Make ISBN/DOI optional
      if (result.doi) {
          isbn = result.doi; // Also assign DOI to the isbn field if available
      }
      showResults = false; // Hide the search results dropdown after selection

      console.log(`Selected book: ${title}, ISBN/DOI: ${isbn}`);
  }

</script>

{#if !authReady}
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
          <button class="text-gray-800 font-medium hover:text-blue-600">Dashboard</button>
          <button on:click={() => window.location.href='/library'} class="text-gray-600 hover:text-blue-600">Library</button>
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

    <!-- Content Container -->
    <div class="flex-1 py-8 px-6 md:px-12 max-w-6xl mx-auto w-full">
      <!-- Welcome Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-800">Welcome back, {firstName}!</h1>
      </div>
      
      <!-- Metric Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <!-- Pages Read Today -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-sm font-medium text-gray-500">Pages Read Today</p>
              <p class="text-3xl font-bold mt-1">{todayStats.pagesRead}</p>
              <p class="text-sm {todayStats.progressFromYesterday > 0 ? 'text-green-600' : todayStats.progressFromYesterday < 0 ? 'text-red-600' : 'text-gray-500'} mt-1">
                {todayStats.progressFromYesterday > 0 ? `+${todayStats.progressFromYesterday}` : 
                 todayStats.progressFromYesterday < 0 ? todayStats.progressFromYesterday : 
                 'Same as yesterday'}
              </p>
            </div>
            <BookMarked class="w-6 h-6 text-blue-600" />
          </div>
        </div>
        
        <!-- Reading Time Today -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-sm font-medium text-gray-500">Reading Time Today</p>
              <p class="text-3xl font-bold mt-1">{todayStats.readingTime} hrs</p>
              <p class="text-sm text-gray-500 mt-1">{todayStats.pagesPerHour} pages/hour</p>
            </div>
            <Timer class="w-6 h-6 text-purple-600" />
          </div>
        </div>
        
        <!-- Weekly Pages -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-sm font-medium text-gray-500">Weekly Pages</p>
              <p class="text-3xl font-bold mt-1">{todayStats.weeklyPages}</p>
              <p class="text-sm text-gray-500 mt-1">{todayStats.weeklyHours} hrs total</p>
            </div>
            <TrendingUp class="w-6 h-6 text-green-600" />
          </div>
        </div>
      </div>
      
      <!-- Main Content -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Recent Reading Sessions -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <ClipboardList class="w-5 h-5" /> Recent Reading Sessions
            </h2>
            <button class="text-blue-600 hover:text-blue-800 flex items-center text-sm font-medium" on:click={openLogReadingModal}>
              <Plus class="w-4 h-4 mr-1" /> Log Session
            </button>
          </div>
          
          {#if libraryList.length === 0 || !libraryList.some(pub => pub.readingSessions && pub.readingSessions.length > 0)}
            <div class="flex flex-col items-center justify-center text-center text-gray-500 py-12">
              <p class="text-lg font-medium">No reading sessions yet.</p>
              <p class="text-sm mt-2">Start by logging your first reading session!</p>
            </div>
          {:else}
            <div class="space-y-4">
              {#each getRecentlyReadPublications() as pub}
                {#if pub.readingSessions && pub.readingSessions.length > 0}
                  {@const lastSession = pub.readingSessions[pub.readingSessions.length - 1]}
                  <div class="border border-gray-100 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors" 
                       on:click={() => openViewModal(pub)}
                       on:keydown={(e) => {if (e.key === 'Enter') openViewModal(pub)}}>
                    <div class="flex justify-between items-start mb-2">
                      <h3 class="font-medium text-gray-800">{pub.title}</h3>
                      <span class="text-xs text-gray-500">{getTimeSince(lastSession.date)}</span>
                    </div>
                    <p class="text-sm text-gray-600 mb-3">{pub.author}</p>
                    <div class="flex justify-between items-center">
                      <div class="flex items-center gap-2">
                        <BookOpen class="w-4 h-4 text-gray-500" />
                        <span class="text-sm text-gray-600">{lastSession.pagesRead} pages</span>
                      </div>
                      {#if lastSession.duration}
                        <div class="flex items-center gap-2">
                          <Clock class="w-4 h-4 text-gray-500" />
                          <span class="text-sm text-gray-600">{lastSession.duration} min</span>
                        </div>
                      {/if}
                    </div>
                  </div>
                {/if}
              {/each}
              
              <div class="mt-4 text-center">
                <button on:click={() => window.location.href='/library'} class="text-blue-600 text-sm font-medium hover:text-blue-800">
                  VIEW LIBRARY
                </button>
              </div>
            </div>
          {/if}
        </div>
        
        <!-- Reading Analytics -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 class="text-xl font-semibold text-gray-800 flex items-center gap-2 mb-6">
            <PieChartIcon class="w-5 h-5" /> Reading Analytics
          </h2>
          
          <!-- Pages Read Over Time -->
          <div class="mb-12">
            <h3 class="text-base font-medium text-gray-700 mb-4">Pages Read Over Time</h3>
            <div class="h-60 flex items-center justify-center">
              <TimelineChart period="30 Days" chartKey={$chartRefreshKey} />
            </div>
          </div>
          
          <!-- Separator -->
          <div class="border-t border-gray-100 my-6"></div>
          
          <!-- Reading Streak -->
          <div class="mt-8">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-base font-medium text-gray-700">Reading Streak</h3>
              <div class="flex items-center gap-1 text-orange-500 font-medium text-sm">
                <Flame class="w-4 h-4" />
                <span>{$currentStreak} days</span>
              </div>
            </div>
            
            <!-- Dynamic Streak Visualization based on real data -->
            <div class="flex w-full gap-2 my-5 px-2">
              {#each Array(7) as _, i}
                {@const today = new Date().getDay() || 7}
                {@const dayNumber = i + 1}
                {@const daysAgo = today >= dayNumber ? today - dayNumber : today + 7 - dayNumber}
                {@const isActive = daysAgo < $currentStreak}
                <div class="flex-1">
                  <div class={`h-4 rounded ${isActive ? 'bg-orange-500' : 'bg-gray-200'}`}></div>
                </div>
              {/each}
            </div>
            
            {#if $currentStreak >= 7}
              <p class="text-sm text-center text-orange-600 mt-3 font-medium">Perfect week!</p>
            {/if}
          </div>
        </div>
      </div>
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
        
        <div class="mb-4">
            <label class="flex items-center cursor-pointer">
                <input 
                    type="checkbox" 
                    bind:checked={markCompletedWithRating} 
                    class="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <span class="ml-2 text-sm text-gray-700">Mark publication as completed</span>
            </label>
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
              {#if libraryList.length === 0}
                <option value="" disabled>No publications available</option>
              {:else}
                {#each libraryList as pub}
                  <option value={pub.id}>{pub.title}</option>
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

<!-- View Publication Dialog -->
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