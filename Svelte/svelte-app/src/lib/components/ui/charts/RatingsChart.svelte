<script>
    import { onMount, onDestroy, afterUpdate } from 'svelte';
    import { Chart, ArcElement, Title, Tooltip, Legend } from 'chart.js';
    import { auth, firestore } from "/src/firebase";
    import { doc, getDoc } from "firebase/firestore";
    
    // Register the components we need
    Chart.register(ArcElement, Title, Tooltip, Legend);
    
    export let chartKey; // Used to force refresh
    
    let chart;
    let ctx;
    let loaded = false;
    
    // Rating star colors
    const ratingColors = [
        "#FF5252", // 1 star - red
        "#FFA726", // 2 stars - orange
        "#FFEB3B", // 3 stars - yellow
        "#66BB6A", // 4 stars - green
        "#26A69A"  // 5 stars - teal
    ];
    
    // Rating labels
    const ratingLabels = [
        "1 ★",
        "2 ★★",
        "3 ★★★",
        "4 ★★★★",
        "5 ★★★★★"
    ];
    
    // Data structure for the chart
    let chartData = {
        labels: ratingLabels,
        data: [0, 0, 0, 0, 0], // Default data, one for each rating
    };
    
    async function fetchRatingsData() {
        const user = auth.currentUser;
        if (!user) {
            console.error("No authenticated user found for ratings chart.");
            return;
        }
        
        try {
            const userDocRef = doc(firestore, "users", user.uid);
            const ratingsDocRef = doc(userDocRef, "charts", "ratings");
            const docSnap = await getDoc(ratingsDocRef);
            
            // Default data structure (all zeros)
            let ratingsData = [0, 0, 0, 0, 0];
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log("Raw ratings data from Firestore:", data);
                
                // Process the data from Firestore
                for (let i = 1; i <= 5; i++) {
                    // Firestore stores keys as strings
                    const count = data[i.toString()] || 0;
                    ratingsData[i-1] = count;
                }
            } else {
                console.log("No ratings data found in Firestore.");
            }
            
            // Update the chart data
            chartData.data = ratingsData;
            console.log("Processed ratings data:", ratingsData);
            
            return ratingsData;
        } catch (error) {
            console.error("Error fetching ratings data:", error);
            return [0, 0, 0, 0, 0];
        }
    }
    
    async function createChart() {
        await fetchRatingsData();
        
        if (!ctx) {
            console.warn("Canvas context not available for ratings chart");
            return;
        }
        
        if (chart) {
            chart.destroy();
        }
        
        chart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: chartData.labels,
                datasets: [{
                    data: chartData.data,
                    backgroundColor: ratingColors,
                    hoverBackgroundColor: ratingColors,
                    borderWidth: 1,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            font: { size: 12 },
                            padding: 10,
                            usePointStyle: true,
                            generateLabels: function(chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    return data.labels.map(function(label, i) {
                                        const meta = chart.getDatasetMeta(0);
                                        const style = meta.controller.getStyle(i);
                                        const value = data.datasets[0].data[i] || 0;
                                        
                                        return {
                                            text: `${label} (${value})`,
                                            fillStyle: style.backgroundColor,
                                            strokeStyle: style.borderColor,
                                            lineWidth: style.borderWidth,
                                            hidden: isNaN(data.datasets[0].data[i]) || meta.data[i].hidden,
                                            index: i
                                        };
                                    });
                                }
                                return [];
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                return `${label}: ${value} publication(s)`;
                            }
                        }
                    }
                }
            }
        });
        
        loaded = true;
        console.log("Ratings chart created with data:", chartData.data);
    }
    
    onMount(() => {
        ctx = document.getElementById('ratingsChart').getContext('2d');
        createChart();
    });
    
    // Force chart refresh when chartKey changes
    $: if (chartKey && loaded) {
        console.log("Refreshing ratings chart due to chartKey update");
        createChart();
    }
    
    afterUpdate(() => {
        if (loaded) {
            createChart();
        }
    });
    
    onDestroy(() => {
        if (chart) chart.destroy();
    });
</script>

<style>
    .ratings-chart-container {
        height: 100%;
        width: 100%;
        min-height: 200px;
        position: relative;
    }
    
    canvas {
        width: 100% !important;
        height: 100% !important;
    }
</style>

<div class="ratings-chart-container">
    <canvas id="ratingsChart"></canvas>
</div>

  