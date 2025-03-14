<script>
    import { onMount, onDestroy, afterUpdate } from "svelte";
    import { Chart, LineElement, CategoryScale, LinearScale, PointElement, Title, Tooltip, Legend } from "chart.js";

    Chart.register(LineElement, CategoryScale, LinearScale, PointElement, Title, Tooltip, Legend);

    export let selectedRange = "30 Days"; // Default time range

    let chart;
    let ctx;

    // Generate dummy data for different time ranges
    function generateData(days) {
        return Array.from({ length: days }, () => Math.floor(Math.random() * 100));
    }

    function getChartData() {
        let days = selectedRange === "30 Days" ? 30 : selectedRange === "60 Days" ? 60 : 90;
        return {
            labels: Array.from({ length: days }, (_, i) => `Day ${i + 1}`),
            datasets: [{
                label: "Pages Read",
                data: generateData(days),
                borderColor: "#36A2EB",
                backgroundColor: "rgba(54, 162, 235, 0.2)",
                fill: true,
                tension: 0.3
            }]
        };
    }

    function createChart() {
        if (!ctx) return;

        if (chart) {
            chart.destroy(); // Destroy existing chart before creating a new one
        }

        chart = new Chart(ctx, {
            type: "line",
            data: getChartData(),
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false // Hide legend
                    },
                    tooltip: {
                        enabled: true
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: "Days"
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: "Pages Read"
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    onMount(() => {
        ctx = document.getElementById("timelineChart").getContext("2d");
        createChart();
    });

    afterUpdate(() => {
        createChart(); // Update chart when `selectedRange` changes
    });

    onDestroy(() => {
        if (chart) chart.destroy();
    });
</script>

<canvas id="timelineChart"></canvas>