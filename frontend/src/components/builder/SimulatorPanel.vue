<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useStore } from '@/store';

const store = useStore();
const dbg = computed(() => store.state.debugger);
const steps = computed(() => dbg.value.steps);
const timeline = computed(() => dbg.value.timeline);
const totalMs = computed(() => store.getters['debugger/totalDurationMs']);

onMounted(() => store.dispatch('debugger/loadTimeline'));

const simulate = () => store.dispatch('debugger/simulate');
const stepForward = () => store.dispatch('debugger/stepForward');
const stepBack = () => store.dispatch('debugger/stepBack');
const reset = () => store.dispatch('debugger/reset');
const jumpTo = (seq: number) => store.dispatch('debugger/jumpTo', seq);
</script>

<template>
  <div class="sim">
    <div class="row">
      <h4>Simulator</h4>
      <div class="spacer" />
      <button v-can="'workflow.execute'" class="btn-primary" @click="simulate">▶ Run</button>
    </div>

    <div class="row controls" v-if="steps.length">
      <button @click="stepBack">⏮</button>
      <button @click="stepForward">⏭</button>
      <button @click="reset">Reset</button>
      <span class="spacer" />
      <span class="badge" :class="dbg.status === 'FAILED' ? 'draft' : 'published'">{{ dbg.status }}</span>
      <span class="muted">{{ totalMs }}ms</span>
    </div>

    <!-- Execution log / debugger (features 10 & 11) -->
    <ul class="steps">
      <li v-for="(s, i) in steps" :key="s.nodeId + i" :class="s.status">
        <span class="ico">{{ s.status === 'success' ? '✓' : s.status === 'failed' ? '✕' : '–' }}</span>
        <span class="t">{{ s.type }}</span>
        <span class="spacer" />
        <span class="muted">{{ s.durationMs }}ms</span>
        <div v-if="s.error" class="err">{{ s.error }}</div>
      </li>
    </ul>

    <!-- Time-travel debugging (feature 19) -->
    <h4>Time Travel</h4>
    <ul class="timeline">
      <li v-for="t in timeline" :key="t.seq">
        <button class="link" @click="jumpTo(t.seq)">#{{ t.seq }} {{ t.type }}</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.sim {
  width: 300px;
  border-left: 1px solid var(--border);
  padding: 0.85rem;
  overflow: auto;
}
.controls {
  margin: 0.5rem 0;
}
.steps,
.timeline {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.steps li {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.5rem;
  background: var(--surface);
  border-radius: 6px;
  flex-wrap: wrap;
}
.steps li.failed {
  border-left: 3px solid var(--danger);
}
.steps li.success {
  border-left: 3px solid var(--success);
}
.steps li.skipped {
  opacity: 0.6;
}
.err {
  flex-basis: 100%;
  color: var(--danger);
  font-size: 0.75rem;
}
.link {
  background: none;
  padding: 0.2rem 0;
  color: var(--primary);
  text-align: left;
  width: 100%;
}
</style>
