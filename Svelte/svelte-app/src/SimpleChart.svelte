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

    });
  
    onDestroy(() => {
      if (chart) {
        chart.destroy();
      }
    });
  </script>
  
  <style>
    .chart-container {
      width: 80%;
      margin: 0 auto;
      padding: 20px;
      background-color: white;
      border-radius: 10px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
  
    canvas {
      width: 100% !important;
    }
  </style>
  
  <div class="chart-container">
    <h3>Monthly Sales</h3>
    <canvas id="myChart"></canvas>
  </div>
  