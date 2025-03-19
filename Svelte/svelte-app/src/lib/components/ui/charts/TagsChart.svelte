<script>
    import { onMount, onDestroy } from 'svelte';
    import { Chart, LinearScale, CategoryScale, BarElement, BarController, Title, Tooltip, Legend } from 'chart.js'; // Import necessary components
  
    // Register the components manually
    Chart.register(LinearScale, CategoryScale, BarElement, BarController, Title, Tooltip, Legend);
  
    let chart;
  
    onMount(() => {
        const chartData = {
        labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple'],
        datasets: [{
            data: [300, 50, 100, 150, 200],
            backgroundColor: generateRandomColors(5), // Function to generate random colors
            hoverBackgroundColor: generateRandomColors(5), // Random hover colors
        }],
        };

        function generateRandomColors(num) {
        const colors = [];
        for (let i = 0; i < num; i++) {
            const randomColor = `#${Math.floor(Math.random() * 16777215).toString(16)}`;
            colors.push(randomColor);
        }
        return colors;
        }

  
        const ctx = document.getElementById('myChart').getContext('2d');
        chart = new Chart(ctx, {
        type: 'pie', // Specify the chart type as 'pie'
        data: chartData, // Use the same data for the pie chart
        options: {
            responsive: true,
            plugins: {
            legend: {
                position: 'top', // You can change the legend position if needed
            },
            tooltip: {
                enabled: true, // Enable tooltips on hover
            }
            }
        }
        });

        const ctx2 = document.getElementById('myProgressBar').getContext('2d');
        const progressBar = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: ['Progress', 'Remaining'],
            datasets: [{
            data: [70, 30], // Progress is 70%, Remaining is 30%
            backgroundColor: ['#36A2EB', '#CCCCCC'], // Progress color and remaining color
            hoverBackgroundColor: ['#36A2EB', '#CCCCCC'],
            }]
        },
        options: {
            responsive: true,
            cutout: '80%', // Creates a 'donut' effect by cutting out the center
            plugins: {
            legend: {
                display: false, // Hide legend if not needed
            },
            tooltip: {
                enabled: false, // Disable tooltips
            }
            }
        }
        });

        const ctx3 = document.getElementById('lineChart').getContext('2d');
        chart = new Chart(ctx3, {
        type: 'line', // Specify the chart type
        data: {
            labels: Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`), // Last 30 days (Day 1 to Day 30)
            datasets: [{
            label: 'Pages Read',
            data: generateDummyData(), // Generate dummy data
            borderColor: '#36A2EB', // Line color
            fill: false, // Don't fill the area under the line
            tension: 0.1, // Smooth the line
            }]
        },
        options: {
            plugins: {
                    legend: {  
                        display: false, 
                    },
                },
            responsive: true,
            scales: {
            x: {
                title: {
                display: true,
                text: 'Days'
                }
            },
            y: {
                beginAtZero: true,
                title: {
                display: true,
                text: 'Pages Read'
                }
            }
            }
        }
        });


    });

    // Function to generate dummy data for pages read over 30 days
    function generateDummyData() {
        return Array.from({ length: 30 }, () => Math.floor(Math.random() * 100)); // Random pages between 0 and 100
    }
    
    function updateChart(newPagesRead) {
        chart.data.datasets[0].data.push(newPagesRead); // Add new pages read data
        chart.data.labels.push(`Day ${chart.data.labels.length + 1}`); // Add label for the new day
        chart.update(); // Update the chart with the new data
    }

    function updateProgressBar(progress) {
        progressBar.data.datasets[0].data = [progress, 100 - progress]; // Update the data
        progressBar.update(); // Update the chart
    }


    onDestroy(() => {
      if (chart) {
        chart.destroy();
      }
    });

</script>

<canvas id="myChart"></canvas>
  