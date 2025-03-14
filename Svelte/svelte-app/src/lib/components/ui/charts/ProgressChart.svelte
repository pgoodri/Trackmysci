<script>
    import { onMount, onDestroy, afterUpdate } from "svelte";
    import { Chart, ArcElement, Title, Tooltip, Legend } from "chart.js";

    Chart.register(ArcElement, Title, Tooltip, Legend);

    export let selectedView = "All Progress"; // Default progress type
    let chart;
    let ctx;

    // Dummy data for demonstration
    function getProgressData(view) {
        if (view === "Most Recent Book Progress") {
            return { completed: 180, remaining: 120, label: "Most Recent Book" }; // Example: 180 pages read out of 300
        }
        return { completed: 600, remaining: 400, label: "Total Progress" }; // Example: 600 pages read out of 1000 total
    }

    function createChart() {
        if (!ctx) return;

        const { completed, remaining, label } = getProgressData(selectedView);

        if (chart) {
            chart.destroy(); // Destroy existing chart to update
        }

        chart = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: ["Completed", "Remaining"],
                datasets: [{
                    data: [completed, remaining],
                    backgroundColor: ["#36A2EB", "#CCCCCC"], // Blue for progress, Gray for remaining
                    hoverBackgroundColor: ["#36A2EB", "#AAAAAA"],
                }]
            },
            options: {
                responsive: true,
                cutout: "70%", // Creates the donut effect
                plugins: {
                    legend: {
                        position: "bottom"
                    },
                    tooltip: {
                        enabled: true
                    },
                    title: {
                        display: true,
                        text: label
                    }
                }
            }
        });
    }

    onMount(() => {
        ctx = document.getElementById("progressChart").getContext("2d");
        createChart();
    });

    afterUpdate(() => {
        createChart(); // Update chart when selectedView changes
    });

    onDestroy(() => {
        if (chart) chart.destroy();
    });
</script>

<canvas id="progressChart"></canvas>