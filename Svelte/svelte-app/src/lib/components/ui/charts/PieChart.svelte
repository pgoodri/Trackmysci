<script>
    import { onMount, onDestroy } from "svelte";
    import { Chart, CategoryScale, ArcElement, Title, Tooltip, Legend } from "chart.js";

    Chart.register(CategoryScale, ArcElement, Title, Tooltip, Legend);

    let chart;

    onMount(() => {
        const chartData = {
            labels: ["Red", "Blue", "Yellow", "Green", "Purple"],
            datasets: [
                {
                    data: [300, 50, 100, 150, 200],
                    backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56", "#4CAF50", "#9C27B0"],
                    hoverBackgroundColor: ["#FF6384", "#36A2EB", "#FFCE56", "#4CAF50", "#9C27B0"],
                }
            ],
        };

        const ctx = document.getElementById("pieChart").getContext("2d");
        chart = new Chart(ctx, {
            type: "pie",
            data: chartData,
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
                            boxWidth: 4, 
                            boxHeight: 4, 
                        }
                    },
                    tooltip: {
                        enabled: true // Allows tooltips on hover
                    }
                }
            }
        });
    });

    onDestroy(() => { if (chart) chart.destroy(); });
</script>

<canvas id="pieChart"></canvas>
