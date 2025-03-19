<script>
    import { onMount, afterUpdate } from "svelte";
    import { writable } from "svelte/store";
    import { auth, firestore } from "/src/firebase";
    import { doc, getDoc, collection, getDocs } from "firebase/firestore";

    export let selectedView = "All Progress";
    export let updateProgress;
    export let chartKey; // Used to force re-render

    let progressPercentage = writable(0);

    async function fetchProgressData(view) {
    const user = auth.currentUser;
    if (!user) {
        console.error("No authenticated user found.");
        return;
    }

    try {
        const userDocRef = doc(firestore, "users", user.uid);
        const libraryRef = collection(userDocRef, "library");
        const summaryDocRef = doc(collection(userDocRef, "charts"), "summary");

        let completed = 0;
        let remaining = 0;
        let label = "Loading...";

        if (view === "Most Recent Book Progress") {
            const summarySnap = await getDoc(summaryDocRef);
            if (!summarySnap.exists()) {
                console.warn("No summary data found.");
                return;
            }

            const mostRecentTitle = summarySnap.data().mostRecent;
            if (!mostRecentTitle) {
                console.warn("No most recent book found.");
                return;
            }

            const librarySnap = await getDocs(libraryRef);
            let recentBook = null;

            librarySnap.forEach(docSnap => {
                const entry = docSnap.data();
                if (entry.title === mostRecentTitle) {
                    recentBook = entry;
                }
            });

            if (!recentBook) {
                console.warn("Most recent book not found in library.");
                return;
            }

            completed = recentBook.currentPage - recentBook.pageStart;
            remaining = recentBook.pageEnd - recentBook.pageStart - completed;
            label = recentBook.title;

        } else {
            let totalPagesRead = 0;
            let totalPagesAvailable = 0;

            const librarySnap = await getDocs(libraryRef);
            librarySnap.forEach(docSnap => {
                const entry = docSnap.data();
                if (entry.currentPage && entry.pageStart && entry.pageEnd) {
                    totalPagesRead += entry.currentPage - entry.pageStart;
                    totalPagesAvailable += entry.pageEnd - entry.pageStart;
                }
            });

            completed = totalPagesRead;
            remaining = totalPagesAvailable - totalPagesRead;
            label = "Total Reading Progress";
        }

        const percentage = completed + remaining === 0 ? 0 : Math.round((completed / (completed + remaining)) * 100);
        updateProgress(percentage);
        progressPercentage.set(percentage);

    } catch (error) {
        console.error("Error fetching progress data:", error.message);
    }
}


    // ✅ Reactively update when chartKey changes
    $: if (chartKey !== undefined) {
        fetchProgressData(selectedView);
    }

    onMount(async () => {
        await fetchProgressData(selectedView);
    });

</script>
