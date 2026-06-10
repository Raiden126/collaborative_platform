<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { Line } from 'vue-chartjs';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { useStore } from '@/store';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const store = useStore();
const summary = computed(() => store.state.analytics.summary);

onMounted(() => store.dispatch('analytics/load'));

const stats = computed(() => {
  const s = summary.value;
  return [
    { label: 'Total Workflows', value: s?.totalWorkflows ?? 0 },
    { label: 'Active (Published)', value: s?.activeWorkflows ?? 0 },
    { label: 'Failed Executions', value: s?.failedExecutions ?? 0 },
    { label: 'Success Rate', value: `${s?.successRate ?? 0}%` },
  ];
});

const chartData = computed(() => ({
  labels: summary.value?.trend.map((t) => t.date.slice(5)) ?? [],
  datasets: [
    {
      label: 'Success',
      data: summary.value?.trend.map((t) => t.success) ?? [],
      borderColor: '#10b981',
      backgroundColor: 'rgba(16,185,129,0.15)',
      fill: true,
      tension: 0.3,
    },
    {
      label: 'Failed',
      data: summary.value?.trend.map((t) => t.failed) ?? [],
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239,68,68,0.15)',
      fill: true,
      tension: 0.3,
    },
  ],
}));
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#94a3b8' } } },
  scales: {
    x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
    y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
  },
};
</script>

<template>
  <div>
    <h2>Dashboard</h2>
    <div class="stats">
      <div v-for="s in stats" :key="s.label" class="card stat">
        <div class="value">{{ s.value }}</div>
        <div class="muted">{{ s.label }}</div>
      </div>
    </div>
    <div class="card chart">
      <h3>Execution Trends (14 days)</h3>
      <div class="chart-wrap"><Line :data="chartData" :options="chartOptions" /></div>
    </div>
  </div>
</template>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin: 1rem 0;
}
.stat .value {
  font-size: 2rem;
  font-weight: 700;
}
.chart-wrap {
  height: 320px;
}
</style>
