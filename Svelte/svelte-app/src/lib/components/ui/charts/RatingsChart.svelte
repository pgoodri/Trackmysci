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
    
    // Rating star colors - slightly more vibrant and modern
    const ratingColors = [
        "#FF5252", // 1 star - red
        "#FF9800", // 2 stars - orange
        "#FFC107", // 3 stars - yellow
        "#4CAF50", // 4 stars - green
        "#009688"  // 5 stars - teal
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
            type: 'doughnut', // Changed from pie to doughnut for a more modern look
            data: {
                labels: chartData.labels,
                datasets: [{
                    data: chartData.data,
                    backgroundColor: ratingColors,
                    hoverBackgroundColor: ratingColors.map(color => {
                        // Slightly lighten the colors on hover
                        return color + '99'; // Add transparency for hover effect
                    }),
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    hoverBorderWidth: 3,
                    spacing: 2, // Add spacing between segments
                    borderRadius: 4, // Rounded corners on segments
                    offset: 2 // Slight offset for 3D-like effect
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%', // Doughnut hole size
                layout: {
                    padding: 8 // Padding around the chart
                },
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 800,
                    easing: 'easeOutBack'
                },
                plugins: {
                    legend: {
                        position: 'right',
                        align: 'center',
                        labels: {
                            font: { 
                                size: 11,
                                family: "'Inter', sans-serif"
                            },
                            padding: 14,
                            usePointStyle: true,
                            pointStyle: 'circle', // Use circle instead of rectangle for legend
                            boxWidth: 8, // Smaller legend markers
                            boxHeight: 8,
                            color: '#333',
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
                                            strokeStyle: '#ffffff',
                                            lineWidth: 1,
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
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#333',
                        bodyColor: '#333',
                        bodyFont: {
                            size: 13
                        },
                        titleFont: {
                            size: 14,
                            weight: 'bold'
                        },
                        padding: 10,
                        borderColor: 'rgba(0, 0, 0, 0.1)',
                        borderWidth: 1,
                        displayColors: true,
                        cornerRadius: 6,
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} publication(s) · ${percentage}%`;
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
        .ratings-chart-container {
            min-height: 180px;
        }
    }
</style>

<div class="ratings-chart-container">
    <canvas id="ratingsChart"></canvas>
</div>

  