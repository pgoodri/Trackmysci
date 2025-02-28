<script>
    import { onMount, onDestroy, afterUpdate } from "svelte";
    import { Chart, ArcElement, Title, Tooltip } from "chart.js";

    Chart.register(ArcElement, Title, Tooltip);

    export let streakCount = 5; // Default value (replace with real data)
    let chart;
    let ctx;

    function createChart() {
        if (!ctx) return;

        if (chart) {
            chart.destroy(); // Destroy existing chart
        }

        chart = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: ["Streak", "Remaining"],
                datasets: [{
                    data: [streakCount, 30 - streakCount], // Assume max streak is 30 days
                    backgroundColor: ["#36A2EB", "#CCCCCC"], // Blue for streak, Gray for remaining
                    hoverBackgroundColor: ["#36A2EB", "#AAAAAA"],
                }]
            },
            options: {
                responsive: true,
                cutout: "80%", // Creates the donut effect
                plugins: {
                    tooltip: { enabled: false }, // Disable tooltip
                    title: {
                        display: true,
                        text: "Current Streak"
                    }
                }
            }
        });
    }

    onMount(() => {
        ctx = document.getElementById("streakChart").getContext("2d");
        createChart();
    });

    afterUpdate(() => {
        createChart(); // Update chart when streakCount changes
    });

    onDestroy(() => {
        if (chart) chart.destroy();
    });
</script>

<div class="relative flex items-center justify-center h-full">
    <canvas id="streakChart"></canvas>
    <div class="absolute text-center">
        <p class="text-4xl font-bold text-blue-500">{streakCount}</p>
        <p class="text-sm text-gray-500">Days</p>
    </div>
</div>
