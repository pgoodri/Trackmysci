<script>
    import { onMount, afterUpdate } from "svelte";
    import { auth, firestore } from "/src/firebase";
    import { doc, getDoc, collection } from "firebase/firestore";
    import { writable } from "svelte/store";

    export let streakCount = writable(0);

    async function fetchStreak() {
        const user = auth.currentUser;
        if (!user) {
            console.error("❌ No authenticated user found.");
            return;
        }

        try {
            const summaryDocRef = doc(collection(firestore, "users", user.uid, "charts"), "summary");
            const summaryDocSnap = await getDoc(summaryDocRef);

            if (summaryDocSnap.exists()) {
                const summaryData = summaryDocSnap.data();
                streakCount.set(summaryData.streak || 0);
            }
        } catch (error) {
            console.error("❌ Error fetching streak data:", error.message);
        }
    }

    onMount(async () => {
        await fetchStreak();
    });

    afterUpdate(async () => {
        await fetchStreak();
    });
</script>

<div class="relative flex items-center justify-center h-full">
    <div class="absolute text-center">
        <p class="text-4xl font-bold text-blue-500">{$streakCount}</p>
        <p class="text-sm text-gray-500">Days</p>
    </div>
</div>
