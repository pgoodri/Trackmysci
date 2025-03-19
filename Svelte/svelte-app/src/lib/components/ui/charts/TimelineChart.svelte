<script>
    import { onMount, onDestroy, afterUpdate } from "svelte";
    import { Chart, LineElement, CategoryScale, LinearScale, PointElement, Title, Tooltip, Legend } from "chart.js";
    import { auth, firestore } from "/src/firebase";
    import { doc, getDoc } from "firebase/firestore";
    import { writable, get } from "svelte/store";

    Chart.register(LineElement, CategoryScale, LinearScale, PointElement, Title, Tooltip, Legend);

    export let selectedRange = "30 Days"; // Passed from Dashboard
    export let chartRefreshKey; // Passed from Dashboard

    let chart;
    let ctx;
    let readingLog = writable([]);

    function getDateNDaysAgo(n) {
        const today = new Date();
        today.setDate(today.getDate() - n);
        return today.toISOString().split("T")[0];
    }

    async function fetchReadingLog() {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const summaryDocRef = doc(firestore, "users", user.uid, "charts", "summary");
            const summaryDocSnap = await getDoc(summaryDocRef);

            if (summaryDocSnap.exists()) {
                const summaryData = summaryDocSnap.data();
                readingLog.set(summaryData.readingLog || []);
            } else {
                readingLog.set([]);
            }
        } catch (error) {
            console.error("Error fetching reading log:", error);
        }
    }

    function getChartData(logData) {
        let days = selectedRange === "30 Days" ? 30 : selectedRange === "60 Days" ? 60 : 90;
        let fullDateRange = Array.from({ length: days }, (_, i) => getDateNDaysAgo(i)).reverse();

        let dataMap = {};
        logData.forEach(log => {
            dataMap[log.date] = log.pagesRead;
        });

        return {
            labels: fullDateRange.map(date => date.slice(5)),
            datasets: [{
                label: "Pages Read",
                data: fullDateRange.map(date => dataMap[date] || 0),
                borderColor: "#36A2EB",
                backgroundColor: "rgba(54, 162, 235, 0.2)",
                fill: true,
                tension: 0.3
            }]
        };
    }

    function createChart(logData) {
        if (!ctx) return;
        if (chart) chart.destroy();

        chart = new Chart(ctx, {
            type: "line",
            data: getChartData(logData),
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: true } },
                scales: {
                    x: {
                        title: { display: true, text: "Date" },
                        ticks: { autoSkip: true }
                    },
                    y: { title: { display: true, text: "Pages Read" }, beginAtZero: true }
                }
            }
        });
    }

    onMount(async () => {
        ctx = document.getElementById("timelineChart")?.getContext("2d");
        await fetchReadingLog();
        readingLog.subscribe(data => {
            if (data.length > 0) createChart(data);
        });
    });

    afterUpdate(() => {
        let logData = get(readingLog);
        createChart(logData);
    });

    // 🔥 Listen for Chart Refresh Trigger
    $: if (chartRefreshKey) {
        console.log("🔄 Refreshing Timeline Chart...");
        fetchReadingLog().then(() => {
            createChart(get(readingLog));
        });
    }

    onDestroy(() => {
        if (chart) chart.destroy();
    });

</script>

<div class="timeline-container">
    <canvas id="timelineChart"></canvas>
</div>

<style>
    .timeline-container {
        width: 100%;
        height: 200px;
    }
</style>
