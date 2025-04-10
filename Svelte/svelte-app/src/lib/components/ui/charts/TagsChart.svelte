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
    let tagsData = writable({});

    // Predefined colors for the tags - vibrant palette with better contrast
    const tagColors = [
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

    // Function to generate consistent colors for tags
    function getTagColor(index) {
        return tagColors[index % tagColors.length];
    }

    async function fetchTagsData() {
        const user = auth.currentUser;
        if (!user) {
            console.error("No authenticated user found for tags chart.");
            return;
        }

        try {
            // First, try to get data from the charts/tags document
            const userDocRef = doc(firestore, "users", user.uid);
            const tagsDocRef = doc(userDocRef, "charts", "tags");
            const tagsSnapshot = await getDoc(tagsDocRef);

            let tagCounts = {};

            if (tagsSnapshot.exists()) {
                // If the tags summary document exists, use that data
                tagCounts = tagsSnapshot.data();
                console.log("Found tags data in charts collection:", tagCounts);
            } else {
                // If no tags summary exists, scan through the library to count tags
                console.log("No tags summary found, scanning library...");
                const libraryRef = collection(userDocRef, "library");
                const libraryDocs = await getDocs(libraryRef);
                
                libraryDocs.forEach(doc => {
                    const pub = doc.data();
                    if (pub.tags && Array.isArray(pub.tags)) {
                        pub.tags.forEach(tag => {
                            if (tag) {
                                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                            }
                        });
                    }
                });
                
                console.log("Calculated tag counts from library:", tagCounts);
            }

            // Filter out any empty tags and sort by count (descending)
            const filteredTags = Object.entries(tagCounts)
                .filter(([tag, _]) => tag && tag.trim().length > 0)
                .sort((a, b) => b[1] - a[1]);
            
            // Convert to object
            const finalTagsData = Object.fromEntries(filteredTags);
            tagsData.set(finalTagsData);
            
            return finalTagsData;
        } catch (error) {
            console.error("Error fetching tags data:", error);
            return {};
        }
    }

    function createChart() {
        const data = get(tagsData);
        if (!data || Object.keys(data).length === 0) {
            console.log("No tags data to display");
            return;
        }

        if (!ctx) {
            console.warn("Canvas context not available for tags chart");
            return;
        }

        if (chart) {
            chart.destroy();
        }

        // Get tags and counts, limiting to top 10 for readability
        const entries = Object.entries(data).slice(0, 10);
        const labels = entries.map(([tag]) => tag);
        const counts = entries.map(([_, count]) => count);
        const backgroundColor = entries.map((_, i) => getTagColor(i));

        chart = new Chart(ctx, {
            type: 'pie', // Regular pie chart, not doughnut
            data: {
                labels: labels,
                datasets: [{
                    data: counts,
                    backgroundColor: backgroundColor,
                    hoverBackgroundColor: backgroundColor,
                    borderWidth: 1.5,
                    borderColor: '#ffffff',
                    hoverBorderWidth: 2,
                    spacing: 1 // Minimal spacing between segments
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: 5 // Padding around the chart
                },
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
        console.log("Tags pie chart created with data:", Object.keys(data).length, "tags");
    }

    onMount(async () => {
        ctx = document.getElementById('tagsChart').getContext('2d');
        await fetchTagsData();
        createChart();
    });

    // Force chart refresh when chartKey changes
    $: if (chartKey && loaded) {
        console.log("Refreshing tags chart due to chartKey update");
        fetchTagsData().then(() => createChart());
    }

    afterUpdate(() => {
        if (loaded && Object.keys(get(tagsData)).length > 0) {
            createChart();
        }
    });

    onDestroy(() => {
        if (chart) chart.destroy();
    });
</script>

<style>
    .tags-chart-container {
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
        .tags-chart-container {
            min-height: 180px;
        }
    }
</style>

<div class="tags-chart-container">
    <canvas id="tagsChart"></canvas>
</div>