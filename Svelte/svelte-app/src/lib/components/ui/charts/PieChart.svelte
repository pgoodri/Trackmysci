<script>
    import { onMount, onDestroy, afterUpdate } from "svelte";
    import { Chart, ArcElement, Title, Tooltip, Legend } from "chart.js";

    Chart.register(ArcElement, Title, Tooltip, Legend);

    export let type = "Tags"; // Default chart type

    let chart;
    let ctx;

    // Define data for different chart types
    const chartDataSets = {
        Tags: {
            labels: ["Fiction", "Science", "History", "Math", "Technology"],
            data: [40, 20, 30, 10, 25],
            colors: ["#FF6384", "#36A2EB", "#FFCE56", "#4CAF50", "#9C27B0"],
        },
        Ratings: {
            labels: ["1 Star", "2 Stars", "3 Stars", "4 Stars", "5 Stars"],
            data: [5, 10, 25, 40, 20],
            colors: ["#FF0000", "#FF8000", "#FFFF00", "#80FF00", "#00FF00"],
        },
        Authors: {
            labels: ["Tolkien", "Asimov", "Rowling", "Hemingway", "Orwell"],
            data: [15, 20, 30, 35, 25],
            colors: ["#2E86C1", "#A569BD", "#F39C12", "#E74C3C", "#1ABC9C"],
        }
    };

    function createChart() {
        if (!ctx) return;

        if (chart) {
            chart.destroy(); // Destroy existing chart before creating a new one
        }

        chart = new Chart(ctx, {
            type: "pie",
            data: {
                labels: chartDataSets[type].labels,
                datasets: [{
                    data: chartDataSets[type].data,
                    backgroundColor: chartDataSets[type].colors,
                    hoverBackgroundColor: chartDataSets[type].colors,
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {  
                        display: true,
                        position: "right",
                        labels: {
                            font: { size: 12 },
                            color: "#333",
                            padding: 8,
                            usePointStyle: true,
                            pointStyle: "circle",
                            boxWidth: 6,
                            boxHeight: 6,
                        }
                    },
                    tooltip: {
                        enabled: true // Allows tooltips on hover
                    }
                }
            }
        });
    }

    onMount(() => {
        ctx = document.getElementById("pieChart").getContext("2d");
        createChart();
    });

    afterUpdate(() => {
        createChart(); // Update chart when `type` changes
    });

    onDestroy(() => {
        if (chart) chart.destroy();
    });
</script>

<canvas id="pieChart"></canvas>
