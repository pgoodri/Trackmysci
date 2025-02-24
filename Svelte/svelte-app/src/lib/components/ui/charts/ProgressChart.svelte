<script>
    import { onMount, onDestroy } from "svelte";
    import { Chart, ArcElement, Tooltip, Legend } from "chart.js";

    Chart.register(ArcElement, Tooltip, Legend);

    let progressBar;

    onMount(() => {
        const ctx = document.getElementById("progressBar").getContext("2d");
        progressBar = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: ["Progress", "Remaining"],
                datasets: [
                    {
                        data: [70, 30],
                        backgroundColor: ["#36A2EB", "#CCCCCC"],
                        hoverBackgroundColor: ["#36A2EB", "#CCCCCC"],
                    }
                ]
            },
            options: {
                responsive: true,
                cutout: "80%",
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            }
        });
    });

    export function updateProgressBar(progress) {
        progressBar.data.datasets[0].data = [progress, 100 - progress];
        progressBar.update();
    }

    onDestroy(() => { if (progressBar) progressBar.destroy(); });
</script>

<canvas id="progressBar"></canvas>
