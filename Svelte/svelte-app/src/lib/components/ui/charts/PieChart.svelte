<script>
import { onMount, onDestroy, afterUpdate } from "svelte";
import { Chart, ArcElement, Title, Tooltip, Legend } from "chart.js";
import { auth, firestore } from "/src/firebase";
import { doc, getDoc } from "firebase/firestore";

Chart.register(ArcElement, Title, Tooltip, Legend);

export let type = "Tags"; // Default chart type
export let chartKey; // Used to force refresh


let chart;
let ctx;
let chartData = {
    labels: [],
    data: [],
    colors: ["#FF6384", "#36A2EB", "#FFCE56", "#4CAF50", "#9C27B0"]
};

async function fetchChartData() {
    const user = auth.currentUser;
    if (!user) {
        console.error("No authenticated user found.");
        return;
    }

    const userDocRef = doc(firestore, "users", user.uid);
    const chartTypeDocRef = doc(userDocRef, "charts", type.toLowerCase());

    try {
        const docSnap = await getDoc(chartTypeDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            chartData.labels = Object.keys(data);
            chartData.data = Object.values(data);
        } else {
            console.warn(`No ${type} data found.`);
            chartData.labels = [];
            chartData.data = [];
        }
    } catch (error) {
        console.error(`Error fetching ${type} data:`, error);
    }
}

async function createChart() {
    await fetchChartData();

    if (!ctx) return;

    if (chart) {
        chart.destroy();
    }

    chart = new Chart(ctx, {
        type: "pie",
        data: {
            labels: chartData.labels,
            datasets: [{
                data: chartData.data,
                backgroundColor: chartData.colors.slice(0, chartData.labels.length),
                hoverBackgroundColor: chartData.colors.slice(0, chartData.labels.length),
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
                tooltip: { enabled: true }
            }
        }
    });
}

onMount(() => {
    ctx = document.getElementById("pieChart").getContext("2d");
    createChart();
});

// 🔥 Force chart refresh when `chartKey` changes
$: if (chartKey) {
    console.log("🔄 Chart key changed, refreshing PieChart...");
    createChart();
}

afterUpdate(() => {
    createChart();
});

onDestroy(() => {
    if (chart) chart.destroy();
});
</script>

<canvas id="pieChart"></canvas>

