/**
 * @module charts
 * @description Chart.js wrapper for creating and managing donut, line, and bar
 * charts with a consistent visual style. Stores instances in a Map for reuse.
 */

import Chart from 'chart.js/auto';

/** @type {Map<string, Chart>} Active chart instances keyed by canvas ID */
const chartInstances = new Map();

// ---------------------------------------------------------------------------
// Chart.js Global Defaults
// ---------------------------------------------------------------------------
Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
Chart.defaults.color = 'rgba(255, 255, 255, 0.6)';
Chart.defaults.plugins.legend.display = false;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.95)';
Chart.defaults.plugins.tooltip.titleColor = '#fff';
Chart.defaults.plugins.tooltip.bodyColor = 'rgba(255, 255, 255, 0.8)';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(99, 102, 241, 0.3)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.padding = 12;

// ---------------------------------------------------------------------------
// Center-text plugin for donut charts
// ---------------------------------------------------------------------------
const centerTextPlugin = {
  id: 'centerText',
  afterDraw(chart) {
    const meta = chart.options.plugins?.centerText;
    if (!meta) return;

    const { ctx, chartArea } = chart;
    const centerX = (chartArea.left + chartArea.right) / 2;
    const centerY = (chartArea.top + chartArea.bottom) / 2;

    ctx.save();
    // Label (small text)
    if (meta.label) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '500 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(meta.label, centerX, centerY - 4);
    }
    // Value (big text)
    if (meta.value) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(meta.value, centerX, centerY + 2);
    }
    ctx.restore();
  }
};

Chart.register(centerTextPlugin);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Get or verify a canvas element by ID.
 * @param {string} canvasId
 * @returns {HTMLCanvasElement|null}
 */
function getCanvas(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.warn(`[charts] Canvas element #${canvasId} not found`);
    return null;
  }
  return canvas;
}

/**
 * Create a vertical gradient fill for line/bar charts.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} color - Base hex color.
 * @param {{ top: number, bottom: number }} area
 * @returns {CanvasGradient}
 */
function createGradient(ctx, color, area) {
  const gradient = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  gradient.addColorStop(0, color + '40'); // 25% opacity
  gradient.addColorStop(1, color + '05'); // ~2% opacity
  return gradient;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create or update a doughnut (donut) chart.
 * @param {string} canvasId - ID of the target canvas element.
 * @param {Array<{label: string, value: number, color: string}>} data - Segments.
 * @param {Object} [options] - Extra options.
 * @param {string} [options.centerLabel] - Small label in the center.
 * @param {string} [options.centerValue] - Large value in the center.
 * @returns {Chart|null} The Chart instance, or null if canvas not found.
 */
export function createDonutChart(canvasId, data, options = {}) {
  const canvas = getCanvas(canvasId);
  if (!canvas) return null;

  // Destroy existing instance
  if (chartInstances.has(canvasId)) {
    chartInstances.get(canvasId).destroy();
  }

  const labels = data.map(d => d.label);
  const values = data.map(d => d.value);
  const colors = data.map(d => d.color);

  const chart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 6,
        spacing: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      animation: {
        animateRotate: true,
        duration: 800,
        easing: 'easeInOutQuart'
      },
      plugins: {
        legend: { display: false },
        centerText: {
          label: options.centerLabel || '',
          value: options.centerValue || ''
        },
        tooltip: {
          callbacks: {
            label(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
              return ` ${context.label}: ₹${context.parsed.toLocaleString('en-IN')} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * Create or update a line chart.
 * @param {string} canvasId - ID of the target canvas element.
 * @param {{ labels: string[], datasets: Array<{label: string, data: number[], color: string}> }} data
 * @param {Object} [options] - Extra options.
 * @returns {Chart|null} The Chart instance, or null if canvas not found.
 */
export function createLineChart(canvasId, data, options = {}) {
  const canvas = getCanvas(canvasId);
  if (!canvas) return null;

  if (chartInstances.has(canvasId)) {
    chartInstances.get(canvasId).destroy();
  }

  const ctx = canvas.getContext('2d');

  const datasets = data.datasets.map(ds => ({
    label: ds.label,
    data: ds.data,
    borderColor: ds.color,
    backgroundColor: (context) => {
      const chart = context.chart;
      if (!chart.chartArea) return ds.color + '20';
      return createGradient(ctx, ds.color, chart.chartArea);
    },
    borderWidth: 2.5,
    pointRadius: 4,
    pointHoverRadius: 6,
    pointBackgroundColor: ds.color,
    pointBorderColor: '#0f172a',
    pointBorderWidth: 2,
    tension: 0.4,
    fill: true
  }));

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          },
          ticks: {
            maxRotation: 0,
            autoSkipPadding: 20
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          },
          ticks: {
            callback: (value) => '₹' + value.toLocaleString('en-IN')
          },
          beginAtZero: options.beginAtZero !== false
        }
      },
      plugins: {
        legend: { display: datasets.length > 1 },
        tooltip: {
          callbacks: {
            label(context) {
              return ` ${context.dataset.label}: ₹${context.parsed.y.toLocaleString('en-IN')}`;
            }
          }
        }
      },
      animation: {
        duration: 800,
        easing: 'easeInOutQuart'
      }
    }
  });

  chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * Create or update a bar chart.
 * @param {string} canvasId - ID of the target canvas element.
 * @param {{ labels: string[], datasets: Array<{label: string, data: number[], color: string}> }} data
 * @param {Object} [options] - Extra options.
 * @returns {Chart|null} The Chart instance, or null if canvas not found.
 */
export function createBarChart(canvasId, data, options = {}) {
  const canvas = getCanvas(canvasId);
  if (!canvas) return null;

  if (chartInstances.has(canvasId)) {
    chartInstances.get(canvasId).destroy();
  }

  const ctx = canvas.getContext('2d');

  const datasets = data.datasets.map(ds => ({
    label: ds.label,
    data: ds.data,
    backgroundColor: (context) => {
      const chart = context.chart;
      if (!chart.chartArea) return ds.color + '80';
      return createGradient(ctx, ds.color, chart.chartArea);
    },
    borderColor: ds.color,
    borderWidth: 1,
    borderRadius: 8,
    borderSkipped: false,
    hoverBackgroundColor: ds.color + 'CC'
  }));

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      barPercentage: 0.7,
      categoryPercentage: 0.8,
      scales: {
        x: {
          grid: {
            display: false,
            drawBorder: false
          },
          ticks: {
            maxRotation: 0,
            autoSkipPadding: 20
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          },
          ticks: {
            callback: (value) => '₹' + value.toLocaleString('en-IN')
          },
          beginAtZero: true
        }
      },
      plugins: {
        legend: { display: datasets.length > 1 },
        tooltip: {
          callbacks: {
            label(context) {
              return ` ${context.dataset.label}: ₹${context.parsed.y.toLocaleString('en-IN')}`;
            }
          }
        }
      },
      animation: {
        duration: 600,
        easing: 'easeInOutQuart'
      }
    }
  });

  chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * Destroy a chart instance associated with a canvas.
 * @param {string} canvasId - Canvas element ID.
 */
export function destroyChart(canvasId) {
  if (chartInstances.has(canvasId)) {
    chartInstances.get(canvasId).destroy();
    chartInstances.delete(canvasId);
  }
}

/**
 * Update an existing chart's data.
 * @param {string} canvasId - Canvas element ID.
 * @param {Object} newData - New data object matching the chart type.
 */
export function updateChart(canvasId, newData) {
  const chart = chartInstances.get(canvasId);
  if (!chart) {
    console.warn(`[charts] No chart instance found for #${canvasId}`);
    return;
  }

  if (chart.config.type === 'doughnut') {
    // Donut data format: [{label, value, color}]
    if (Array.isArray(newData)) {
      chart.data.labels = newData.map(d => d.label);
      chart.data.datasets[0].data = newData.map(d => d.value);
      chart.data.datasets[0].backgroundColor = newData.map(d => d.color);
    }
  } else {
    // Line/Bar data format: { labels, datasets }
    if (newData.labels) chart.data.labels = newData.labels;
    if (newData.datasets) {
      newData.datasets.forEach((ds, i) => {
        if (chart.data.datasets[i]) {
          chart.data.datasets[i].data = ds.data;
          if (ds.label) chart.data.datasets[i].label = ds.label;
        }
      });
    }
  }

  chart.update('active');
}
