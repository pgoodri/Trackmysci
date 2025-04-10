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
        let days;
        if (selectedRange === "7 Days") {
            days = 7;
        } else if (selectedRange === "30 Days") {
            days = 30;
        } else if (selectedRange === "60 Days") {
            days = 60;
        } else {
            days = 90;
        }
        
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
                borderColor: "#2B6CB0", // Royal blue color for timeline
                backgroundColor: "rgba(43, 108, 176, 0.1)", // Very light blue fill
                borderWidth: 2,
                pointBackgroundColor: "#2B6CB0", // Match the line color
                pointBorderColor: "white",
                pointRadius: 2.5, // Slightly smaller points
                pointHoverRadius: 4,
                fill: true,
                tension: 0.3 // Less curved lines
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
                animation: {
                    duration: 300, // Much shorter animation
                    easing: 'easeOutQuad' // Simpler easing
                },
                plugins: { 
                    legend: { 
                        display: false 
                    }, 
                    tooltip: { 
                        enabled: true,
                        backgroundColor: 'rgba(0, 0, 0, 0.75)', // Darker background for better contrast
                        titleColor: '#ffffff', // White text 
                        bodyColor: '#ffffff', // White text
                        bodyFont: {
                            size: 12
                        },
                        titleFont: {
                            size: 13,
                            weight: 'bold'
                        },
                        padding: 8,
                        displayColors: false,
                        cornerRadius: 4
                    } 
                },
                scales: {
                    x: {
                        title: { 
                            display: true, 
                            text: "Date",
                            font: {
                                size: 12,
                                weight: 'normal'
                            },
                            padding: {top: 8, bottom: 0}
                        },
                        grid: {
                            display: true,
                            drawBorder: false,
                            color: 'rgba(0, 0, 0, 0.03)', // Very light grid
                            lineWidth: 0.5 // Thin lines
                        },
                        ticks: { 
                            autoSkip: true,
                            maxRotation: 0,
                            font: {
                                size: 11
                            },
                            color: '#666'
                        }
                    },
                    y: { 
                        title: { 
                            display: true, 
                            text: "Pages Read",
                            font: {
                                size: 12,
                                weight: 'normal'
                            },
                            padding: {top: 0, bottom: 8}
                        }, 
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                            lineWidth: 1,
                            drawBorder: false
                        },
                        ticks: {
                            font: {
                                size: 11
                            },
                            color: '#666',
                            padding: 8
                        }
                    }
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
        height: 100%;
        min-height: 220px;
        padding: 4px;
        border-radius: 8px;
        overflow: hidden;
        position: relative;
        transition: all 0.3s ease;
    }
    
    canvas {
        width: 100% !important;
        height: 100% !important;
    }
    
    @media (max-width: 768px) {
        .timeline-container {
            min-height: 180px;
        }
    }
</style>
