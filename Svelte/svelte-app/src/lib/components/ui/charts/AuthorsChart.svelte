<script>
    import { onMount, onDestroy, afterUpdate } from 'svelte';
    import { Chart, ArcElement, Title, Tooltip, Legend } from 'chart.js';
    import { auth, firestore } from "/src/firebase";
    import { doc, getDoc, collection, getDocs } from "firebase/firestore";
    import { writable, get } from "svelte/store";

    // Register the components we need
    Chart.register(ArcElement, Title, Tooltip, Legend);

    export let chartKey; // Used to force refresh

    let chart;
    let ctx;
    let loaded = false;
    let authorsData = writable({});

    // Predefined colors for the authors - vibrant palette with better contrast
    const authorColors = [
        "#2563EB", // Royal blue
        "#7C3AED", // Vibrant purple
        "#DB2777", // Deep pink
        "#059669", // Emerald
        "#EA580C", // Burnt orange
        "#0284C7", // Sky blue
        "#9333EA", // Purple
        "#DC2626", // Red
        "#0D9488", // Teal
        "#CA8A04", // Amber
        "#15803D", // Forest green
        "#6366F1"  // Indigo
    ];

    // Function to generate consistent colors for authors
    function getAuthorColor(index) {
        return authorColors[index % authorColors.length];
    }

    async function fetchAuthorsData() {
        const user = auth.currentUser;
        if (!user) {
            console.error("No authenticated user found for authors chart.");
            return;
        }

        try {
            // First, try to get data from the charts/authors document
            const userDocRef = doc(firestore, "users", user.uid);
            const authorsDocRef = doc(userDocRef, "charts", "authors");
            const authorsSnapshot = await getDoc(authorsDocRef);

            let authorCounts = {};

            if (authorsSnapshot.exists()) {
                // If the authors summary document exists, use that data
                authorCounts = authorsSnapshot.data();
                console.log("Found authors data in charts collection:", authorCounts);
            } else {
                // If no authors summary exists, scan through the library to count authors
                console.log("No authors summary found, scanning library...");
                const libraryRef = collection(userDocRef, "library");
                const libraryDocs = await getDocs(libraryRef);
                
                libraryDocs.forEach(doc => {
                    const pub = doc.data();
                    if (pub.author) {
                        authorCounts[pub.author] = (authorCounts[pub.author] || 0) + 1;
                    }
                });
                
                console.log("Calculated author counts from library:", authorCounts);
            }

            // Filter out any empty authors and sort by count (descending)
            const filteredAuthors = Object.entries(authorCounts)
                .filter(([author, _]) => author && author.trim().length > 0)
                .sort((a, b) => b[1] - a[1]);
            
            // Convert to object
            const finalAuthorsData = Object.fromEntries(filteredAuthors);
            authorsData.set(finalAuthorsData);
            
            return finalAuthorsData;
        } catch (error) {
            console.error("Error fetching authors data:", error);
            return {};
        }
    }

    function createChart() {
        const data = get(authorsData);
        if (!data || Object.keys(data).length === 0) {
            console.log("No authors data to display");
            return;
        }

        if (!ctx) {
            console.warn("Canvas context not available for authors chart");
            return;
        }

        if (chart) {
            chart.destroy();
        }

        // Get authors and counts, limiting to top 10 for readability
        const entries = Object.entries(data).slice(0, 10);
        const labels = entries.map(([author]) => author);
        const counts = entries.map(([_, count]) => count);
        const backgroundColor = entries.map((_, i) => getAuthorColor(i));

        chart = new Chart(ctx, {
            type: 'doughnut', // Using doughnut for cleaner look without gaps
            data: {
                labels: labels,
                datasets: [{
                    data: counts,
                    backgroundColor: backgroundColor,
                    hoverBackgroundColor: backgroundColor,
                    borderWidth: 1,
                    borderColor: '#ffffff',
                    hoverBorderWidth: 1.5,
                    spacing: 0, // No spacing to avoid triangular gaps
                    borderRadius: 0 // No border radius to ensure clean edges
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: 5 // Padding around the chart
                },
                cutout: '50%', // Moderate doughnut hole size
                animation: {
                    duration: 300, // Quick animation
                    easing: 'easeOutQuad' // Simple easing
                },
                plugins: {
                    legend: {
                        position: 'right',
                        align: 'start',
                        labels: {
                            font: { 
                                size: 12,
                                weight: 'normal'
                            },
                            padding: 12,
                            usePointStyle: false, // Use default rectangle style for clarity
                            boxWidth: 12, // Slightly larger legend markers
                            boxHeight: 12,
                            color: '#000', // Black text for better contrast
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
                        backgroundColor: 'rgba(0, 0, 0, 0.75)', // Darker background for better contrast
                        titleColor: '#ffffff', // White text
                        bodyColor: '#ffffff', // White text
                        bodyFont: {
                            size: 12
                        },
                        titleFont: {
                            size: 13,
                            weight: 'bold'
                        },
                        padding: 8,
                        displayColors: true,
                        cornerRadius: 4,
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} publications (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });

        loaded = true;
        console.log("Authors pie chart created with data:", Object.keys(data).length, "authors");
    }

    onMount(async () => {
        ctx = document.getElementById('authorsChart').getContext('2d');
        await fetchAuthorsData();
        createChart();
    });

    // Force chart refresh when chartKey changes
    $: if (chartKey && loaded) {
        console.log("Refreshing authors chart due to chartKey update");
        fetchAuthorsData().then(() => createChart());
    }

    afterUpdate(() => {
        if (loaded && Object.keys(get(authorsData)).length > 0) {
            createChart();
        }
    });

    onDestroy(() => {
        if (chart) chart.destroy();
    });
</script>

<style>
    .authors-chart-container {
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
        .authors-chart-container {
            min-height: 180px;
        }
    }
</style>

<div class="authors-chart-container">
    <canvas id="authorsChart"></canvas>
</div>