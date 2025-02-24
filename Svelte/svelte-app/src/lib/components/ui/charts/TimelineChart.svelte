<script>
    import { onMount, onDestroy } from "svelte";
    import { Chart, LineController, LinearScale, CategoryScale, PointElement, LineElement, Title, Tooltip } from "chart.js";

    Chart.register(LineController, LinearScale, CategoryScale, PointElement, LineElement, Title, Tooltip);

    let chart;

    function generateDummyData() {
        return Array.from({ length: 30 }, () => Math.floor(Math.random() * 100)); // Random pages between 0 and 100
    }

    onMount(() => {
        const ctx = document.getElementById("lineChart").getContext("2d");
        chart = new Chart(ctx, {
            type: "line",
            data: {
                labels: Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`),
                datasets: [{
                    label: "Pages Read",
                    data: generateDummyData(),
                    borderColor: "#36A2EB",
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { 
                        display: false // 🚀 This removes the legend
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
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: "Pages Read"
                        }
                    }
                }
            }
        });
    });

    onDestroy(() => { if (chart) chart.destroy(); });
</script>

<canvas id="lineChart"></canvas>
