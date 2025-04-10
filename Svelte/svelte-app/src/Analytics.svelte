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
    getDocs,
    collection,
  } from "firebase/firestore";
  import {
    MoreVertical,
    Gauge,
    Library,
    LogOut,
    ChevronDown,
    ChevronsUpDown,
    BookOpen,
    Clock,
    Calendar,
    Filter,
    Percent,
    BookMarked,
    Timer,
    TrendingUp,
    Plus,
    BarChart,
    ClipboardList,
    Flame,
    Tag,
    PieChart as PieChartIcon,
    BookText,
    User,
    Star,
    Home
  } from "lucide-svelte";
  import { Chart } from "chart.js/auto";
  import { onMount } from "svelte";
  import TagsChart from "./lib/components/ui/charts/TagsChart.svelte";
  import RatingsChart from "./lib/components/ui/charts/RatingsChart.svelte";
  import AuthorsChart from "./lib/components/ui/charts/AuthorsChart.svelte";
  import ProgressChart from "./lib/components/ui/charts/ProgressChart.svelte";
  import TimelineChart from "./lib/components/ui/charts/TimelineChart.svelte";
  import StreakChart from "./lib/components/ui/charts/StreakChart.svelte";

  // Stores for data and UI
  let chartKey = writable(0); // Used to force chart re-render
  let chartRefreshKey = writable(0);
  let currentStreak = writable(0); // Initialize streak to 0
  const batch = writeBatch(firestore);

  // Track today's reading metrics
  let todayStats = {
    pagesRead: 0,
    readingTime: 0,
    pagesPerHour: 0,
    weeklyPages: 0,
    weeklyHours: 0
  };
  
  // Stores for selected chart options
  let selectedPieChart = writable("Tags"); // Options: "Tags", "Authors", "Ratings"
  let selectedTimeline = writable("30 Days");
  let selectedProgress = writable("All Publications");
  let progressPercentage = writable(0);
  let visualizationMode = writable("timeline"); // Options: "timeline", "pie"

  const pieChartOptions = ["Tags", "Authors", "Ratings"];
  const timelineOptions = ["30 Days", "60 Days", "90 Days"];
  const progressOptions = ["All Publications", "Reading Status"];
  
  // Function to toggle visualization mode
  function toggleVisualizationMode(mode) {
    if ($visualizationMode !== mode) {
      visualizationMode.set(mode);
      // Save preference to localStorage
      localStorage.setItem("reading-visualization-mode", mode);
      // Refresh charts
      chartRefreshKey.update(n => n + 1);
    }
  }
  
  // Function to change pie chart data category
  function changePieChartCategory(category) {
    if ($selectedPieChart !== category) {
      selectedPieChart.set(category);
      // Save preference to localStorage
      localStorage.setItem("pie-chart-category", category);
      // Refresh charts
      chartRefreshKey.update(n => n + 1);
    }
  }
  
  // Function to change timeline period
  function changeTimelinePeriod(period) {
    if ($selectedTimeline !== period) {
      selectedTimeline.set(period);
      localStorage.setItem("timeline-period", period);
      chartRefreshKey.update(n => n + 1);
    }
  }
  
  // Initialize from localStorage if available
  onMount(() => {
    // Load visualization mode preference
    const savedMode = localStorage.getItem("reading-visualization-mode");
    if (savedMode && (savedMode === "timeline" || savedMode === "pie")) {
      visualizationMode.set(savedMode);
    }
    
    // Load pie chart category preference
    const savedCategory = localStorage.getItem("pie-chart-category");
    if (savedCategory && pieChartOptions.includes(savedCategory)) {
      selectedPieChart.set(savedCategory);
    }
    
    // Load timeline period preference
    const savedPeriod = localStorage.getItem("timeline-period");
    if (savedPeriod && timelineOptions.includes(savedPeriod)) {
      selectedTimeline.set(savedPeriod);
    }
  });

  // Loading state
  let authReady = false;
  let libraryList = [];
  let firstName = "Guest";
  let lastName = "";

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

        // Check Streak Status
        const summaryDocRef = doc(collection(firestore, "users", user.uid, "charts"), "summary");
        const summaryDocSnap = await getDoc(summaryDocRef);

        if (summaryDocSnap.exists()) {
            const summaryData = summaryDocSnap.data();
            let streak = summaryData.streak || 0;
            let streakDate = summaryData.streakDate || null;
            
            // Use midnight-to-midnight calculation for days
            let today = new Date();
            today.setHours(0, 0, 0, 0);
            let todayString = today.toISOString().split("T")[0];

            if (streakDate) {
                // Check if streak should be reset due to missed days
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const todayString = today.toISOString().split("T")[0];
                
                // If today's date is the same as the streak date, we're still on track
                if (streakDate !== todayString) {
                    const lastLogDate = new Date(streakDate);
                    lastLogDate.setHours(0, 0, 0, 0); // Reset to midnight for proper comparison
                    
                    // Calculate time difference in days based on calendar days
                    const timeDiff = Math.round((today - lastLogDate) / (1000 * 60 * 60 * 24));
                    console.log(`Streak check: Last reading was ${timeDiff} days ago`);

                    if (timeDiff >= 2) {
                        console.log("Streak expired. Resetting...");
                        streak = 0;
                    }
                }
            }
            currentStreak.set(streak);
            console.log(`Current streak: ${streak} days`);
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

        console.log("Loaded library with ratings:", libraryList);
        
        // Calculate reading metrics based on loaded library data
        calculateReadingMetrics();
    } catch (error) {
        console.error("Error loading library:", error.message);
    }
  }

  // Lifecycle functions
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
  
  function logout() {
    signOut(auth)
      .then(() => {
        navigate("/login");
      })
      .catch((error) => {
        console.error("Error signing out:", error);
      });
  }

  // Get statistics about library content
  function getLibraryStats() {
    if (!libraryList || libraryList.length === 0) {
      return {
        total: 0,
        completed: 0,
        inProgress: 0,
        unread: 0,
        completionRate: 0
      };
    }

    const total = libraryList.length;
    const completed = libraryList.filter(item => item.completed).length;
    const inProgress = libraryList.filter(item => 
      !item.completed && item.readingSessions && item.readingSessions.length > 0
    ).length;
    const unread = total - completed - inProgress;
    const completionRate = Math.round((completed / total) * 100) || 0;

    return {
      total,
      completed,
      inProgress,
      unread,
      completionRate
    };
  }
</script>

{#if !authReady}
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
          <button on:click={() => window.location.href='/dashboard'} class="text-gray-600 hover:text-blue-600">
            <Home class="w-4 h-4 inline mr-1" /> Dashboard
          </button>
          <button on:click={() => window.location.href='/library'} class="text-gray-600 hover:text-blue-600">
            <BookText class="w-4 h-4 inline mr-1" /> Library
          </button>
          <button class="text-gray-800 font-medium hover:text-blue-600">
            <BarChart class="w-4 h-4 inline mr-1" /> Analytics
          </button>
        </div>
      </div>
      
      <div class="flex items-center gap-3">
        <button class="text-gray-600 hover:text-blue-600 flex items-center px-3 py-2" on:click={() => window.location.href='/dashboard'}>
          <BookOpen class="w-4 h-4 mr-1" /> Log Session
        </button>
        
        <Button class="bg-blue-600 hover:bg-blue-700" on:click={() => window.location.href='/dashboard'}>
          <Plus class="w-4 h-4 mr-2" /> Add Publication
        </Button>
        
        <button class="size-10 rounded-full bg-gray-200 flex items-center justify-center">
          <span class="text-sm font-medium">{firstName.charAt(0)}{lastName.charAt(0)}</span>
        </button>
      </div>
    </nav>
    
    <!-- Content Container -->
    <div class="flex-1 py-8 px-6 md:px-12 max-w-6xl mx-auto w-full">
      <!-- Page Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-800">Reading Analytics</h1>
        <p class="text-gray-500 mt-2">Visualize your reading habits and explore your collection</p>
      </div>
      
      <!-- First Row: Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <!-- Reading Streak Card -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div class="flex justify-between items-start">
            <h3 class="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Flame class="w-5 h-5 text-orange-500" /> Reading Streak
            </h3>
            <div class="flex items-center gap-1 text-orange-500 font-medium text-lg">
              <span>{$currentStreak} days</span>
            </div>
          </div>
          
          <div class="mt-4">
            <!-- Dynamic Streak Visualization -->
            <div class="flex w-full gap-2 my-5 px-2">
              {#each Array(7) as _, i}
                <div class="flex-1">
                  <div class={`h-4 rounded ${i < $currentStreak ? 'bg-orange-500' : 'bg-gray-200'}`}></div>
                </div>
              {/each}
            </div>
            
            {#if $currentStreak >= 7}
              <p class="text-sm text-center text-orange-600 mt-3 font-medium">Perfect week!</p>
            {/if}
          </div>
        </div>
      
        <!-- Pages Read This Week Card -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div class="flex justify-between items-start">
            <h3 class="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <BookMarked class="w-5 h-5 text-blue-500" /> Weekly Pages
            </h3>
            <div class="text-blue-500 font-medium text-lg">
              {todayStats.weeklyPages}
            </div>
          </div>
          
          <div class="mt-4">
            <div class="flex justify-between items-center mb-2">
              <span class="text-sm text-gray-500">This Week</span>
              <span class="text-sm font-medium">{todayStats.weeklyPages} pages</span>
            </div>
            <Progress value={(todayStats.weeklyPages / 500) * 100} class="h-2" />
            
            <div class="flex justify-between items-center mt-4 mb-2">
              <span class="text-sm text-gray-500">Reading Time</span>
              <span class="text-sm font-medium">{todayStats.weeklyHours} hours</span>
            </div>
            <Progress value={(todayStats.weeklyHours / 10) * 100} class="h-2" />
          </div>
        </div>
      
        <!-- Library Stats Card -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div class="flex justify-between items-start">
            <h3 class="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <BarChart class="w-5 h-5 text-purple-500" /> Library Stats
            </h3>
            <div class="text-purple-500 font-medium text-lg">
              {getLibraryStats().total}
            </div>
          </div>
          
          <div class="mt-4 space-y-3">
            <div class="flex justify-between">
              <span class="text-sm text-gray-500">Completed</span>
              <span class="text-sm font-medium">{getLibraryStats().completed}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-500">In Progress</span>
              <span class="text-sm font-medium">{getLibraryStats().inProgress}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-500">Unread</span>
              <span class="text-sm font-medium">{getLibraryStats().unread}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-500">Completion Rate</span>
              <span class="text-sm font-medium">{getLibraryStats().completionRate}%</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Second Row: Timeline Chart -->
      <div class="mb-8">
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp class="w-5 h-5" /> Reading Activity
            </h2>
            
            <!-- Timeline Period Selector -->
            <div class="relative">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  <button class="flex items-center justify-center px-4 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 transition-all duration-200">
                    {$selectedTimeline} <ChevronDown class="w-3 h-3 ml-2 text-gray-500" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content>
                  <DropdownMenu.Group>
                    {#each timelineOptions as option}
                      <DropdownMenu.Item 
                        class="text-sm {$selectedTimeline === option ? 'text-blue-600 font-medium' : ''}"
                        on:click={() => changeTimelinePeriod(option)}
                      >
                        <Calendar class="h-4 w-4 mr-2" /> 
                        {option}
                      </DropdownMenu.Item>
                    {/each}
                  </DropdownMenu.Group>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </div>
          </div>
          
          <div class="h-80">
            <TimelineChart period={$selectedTimeline} chartKey={$chartRefreshKey} />
          </div>
        </div>
      </div>
      
      <!-- Third Row: Pie Charts (3 column grid) -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <!-- Tags Distribution Chart -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Tag class="w-4 h-4" /> Tags
            </h3>
          </div>
          
          <div class="h-64">
            <TagsChart chartKey={$chartRefreshKey} />
          </div>
        </div>
        
        <!-- Authors Distribution Chart -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <User class="w-4 h-4" /> Authors
            </h3>
          </div>
          
          <div class="h-64">
            <AuthorsChart chartKey={$chartRefreshKey} />
          </div>
        </div>
        
        <!-- Ratings Distribution Chart -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Star class="w-4 h-4" /> Ratings
            </h3>
          </div>
          
          <div class="h-64">
            <RatingsChart chartKey={$chartRefreshKey} />
          </div>
        </div>
      </div>
      
      <!-- Fourth Row: Reading Progress -->
      <div class="mb-6">
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <Percent class="w-5 h-5" /> Reading Progress
            </h2>
          </div>
          
          <div class="h-64">
            <ProgressChart chartKey={$chartRefreshKey} />
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}