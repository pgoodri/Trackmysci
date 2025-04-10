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

    // Predefined colors for the tags - modern palette with better contrast and harmony
    const tagColors = [
        "#4361EE", // Primary blue
        "#3A0CA3", // Dark purple
        "#7209B7", // Purple
        "#F72585", // Pink
        "#4CC9F0", // Light blue
        "#4895EF", // Blue
        "#560BAD", // Deep purple
        "#F3722C", // Orange
        "#F8961E", // Light orange
        "#F9C74F", // Yellow
        "#90BE6D", // Green
        "#43AA8B"  // Teal
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
            type: 'doughnut', // Changed from pie to doughnut for a more modern look
            data: {
                labels: labels,
                datasets: [{
                    data: counts,
                    backgroundColor: backgroundColor,
                    hoverBackgroundColor: backgroundColor.map(color => {
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