<script>
    import { onMount, onDestroy, afterUpdate } from "svelte";
    import { Chart, LineElement, CategoryScale, LinearScale, PointElement, Title, Tooltip, Legend } from "chart.js";
    import { auth, firestore } from "/src/firebase";
    import { doc, getDoc } from "firebase/firestore";
    import { writable } from "svelte/store";

    Chart.register(LineElement, CategoryScale, LinearScale, PointElement, Title, Tooltip, Legend);

    export let selectedRange = "30 Days"; // Default time range

    let chart;
    let ctx;
    let readingLog = writable([]);

    function getDateNDaysAgo(n) {
        const today = new Date(); // Get current date (no extra shifting)
        const date = new Date(today);
        date.setDate(today.getDate() - n); // Subtract days correctly

        console.log(`✅ Corrected Date for ${n} days ago:`, date.toISOString().split("T")[0]);
        return date.toISOString().split("T")[0]; // Returns YYYY-MM-DD
    }

    async function fetchReadingLog() {
        const user = auth.currentUser;
        if (!user) {
            console.warn("No authenticated user found. Skipping fetch.");
            return;
        }

        try {
            const summaryDocRef = doc(firestore, "users", user.uid, "charts", "summary");
            const summaryDocSnap = await getDoc(summaryDocRef);

            if (summaryDocSnap.exists()) {
                const summaryData = summaryDocSnap.data();
                console.log("📝 Raw readingLog data from Firestore:", summaryData.readingLog);
                readingLog.set(summaryData.readingLog || []);
            } else {
                console.warn("No reading log data found.");
                readingLog.set([]);
            }
        } catch (error) {
            console.error("Error fetching reading log:", error);
        }
    }

    function formatDate(dateString) {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`; // Only show MM/DD (No Year)
}

function getChartData(logData) {
    let days = selectedRange === "30 Days" ? 30 : selectedRange === "60 Days" ? 60 : 90;

    // ✅ Generate the correct full date range in YYYY-MM-DD format
    let fullDateRange = Array.from({ length: days }, (_, i) => getDateNDaysAgo(i)).reverse();

    console.log("✅ Full date range (first and last):", fullDateRange[0], "to", fullDateRange[fullDateRange.length - 1]);

    // ✅ Create a dictionary mapping Firestore-stored dates to `pagesRead`
    let dataMap = {};
    logData.forEach(log => {
        console.log("📌 Firestore Log Entry:", log.date, "Pages Read:", log.pagesRead);
        dataMap[log.date] = log.pagesRead; // Store pagesRead by exact Firestore date
    });

    // ✅ Generate the dataset with correctly mapped `pagesRead` values
    let chartData = fullDateRange.map(date => ({
        date: date, // Keep original Firestore date (YYYY-MM-DD)
        pagesRead: dataMap[date] || 0 // Assign the correct `pagesRead` value
    }));

    console.log("📊 FINAL Processed Chart Data (After Fix):", chartData);

    // ✅ Ensure `labels` are formatted as MM/DD while keeping data logic correct
    return {
        labels: chartData.map(log => log.date.slice(5)), // Keep only MM-DD format for Chart.js labels
        datasets: [{
            label: "Pages Read",
            data: chartData.map(log => log.pagesRead),
            borderColor: "#36A2EB",
            backgroundColor: "rgba(54, 162, 235, 0.2)",
            fill: true,
            tension: 0.3
        }]
    };
}


function createChart(logData) {
    if (!ctx) return;

    if (chart) {
        chart.destroy();
    }

    // Get the correct chart data
    let chartData = getChartData(logData);

    // Dynamically determine label interval based on selected range
    let totalDates = chartData.labels.length;
    let labelInterval = Math.floor(totalDates / 5); // Always 5 labels max

    chart = new Chart(ctx, {
        type: "line",
        data: chartData,
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: true }
            },
            scales: {
                x: {
                    title: { display: true, text: "Date" },
                    ticks: {
                        autoSkip: false, // Ensure manual skipping
                        callback: function (value, index, values) {
                            if (index % labelInterval === 0) {
                                return chartData.labels[index]; // Use labels directly from chart data
                            }
                            return "";
                        }
                    }
                },
                y: { 
                    title: { display: true, text: "Pages Read" }, 
                    beginAtZero: true 
                }
            }
        }
    });
}


    onMount(async () => {
        console.log("🚀 Mounting Timeline Chart");
        ctx = document.getElementById("timelineChart")?.getContext("2d");
        await fetchReadingLog();
        readingLog.subscribe(data => {
            console.log("📊 Data received in subscribe:", data);
            createChart(data);
        });
    });

    afterUpdate(async () => {
        console.log("🔄 Chart updated");
        await fetchReadingLog();
        readingLog.subscribe(data => {
            console.log("📊 Data received in afterUpdate:", data);
            createChart(data);
        });
    });

    onDestroy(() => {
        if (chart) chart.destroy();
    });

</script>

<canvas id="timelineChart"></canvas>
