<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useStore } from '@/store';
import type { ExecutionStep } from '@/api';

const store = useStore();
const dbg = computed(() => store.state.debugger);
const steps = computed(() => dbg.value.steps);
const timeline = computed(() => dbg.value.timeline);
const totalMs = computed(() => store.getters['debugger/totalDurationMs']);

// Read activeId directly so the Run button is disabled until open() completes.
const activeId = computed(() => store.state.workflow.activeId);

const expanded = ref(new Set<number>());
function toggle(i: number) {
  const next = new Set(expanded.value);
  next.has(i) ? next.delete(i) : next.add(i);
  expanded.value = next;
}
const hasOutput = (s: ExecutionStep) => s.output !== undefined && s.output !== null;
const format = (v: unknown) => JSON.stringify(v, null, 2);

const triggerJson = ref('');
const triggerError = ref('');
const triggerSyntax = '{{trigger.x}}';

// Load timeline when this panel mounts, AND whenever activeId becomes available
// (handles the race where panel mounts before workflow/open completes).
async function tryLoadTimeline() {
  if (store.state.workflow.activeId != null) {
    await store.dispatch('debugger/loadTimeline');
  }
}
onMounted(tryLoadTimeline);
watch(activeId, (id) => { if (id != null) store.dispatch('debugger/loadTimeline'); });

function run() {
  triggerError.value = '';
  let trigger: Record<string, unknown> | undefined;
  if (triggerJson.value.trim()) {
    try {
      trigger = JSON.parse(triggerJson.value);
    } catch {
      triggerError.value = 'Invalid JSON';
      return;
    }
  }
  store.dispatch('debugger/simulate', trigger);
}
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
      <!-- Disabled until workflow/open() sets activeId -->
      <button
        v-can="'workflow.execute'"
        class="btn-primary"
        :disabled="!activeId || dbg.status === 'running'"
        @click="run"
      >
        {{ dbg.status === 'running' ? '⏳ Running…' : '▶ Run' }}
      </button>
    </div>

    <label class="trigger">
      <span class="muted">Trigger payload (JSON) — referenced as <code>{{ triggerSyntax }}</code></span>
      <textarea v-model="triggerJson" rows="2" placeholder='{ "amount": 150 }' />
      <span v-if="triggerError" class="err">{{ triggerError }}</span>
    </label>

    <div class="row controls" v-if="steps.length">
      <button @click="stepBack">⏮</button>
      <button @click="stepForward">⏭</button>
      <button @click="reset">Reset</button>
      <span class="spacer" />
      <span class="badge" :class="dbg.status === 'FAILED' ? 'draft' : 'published'">{{ dbg.status }}</span>
      <span class="muted">{{ totalMs }}ms</span>
    </div>

    <ul class="steps">
      <li v-for="(s, i) in steps" :key="s.nodeId + i" :class="s.status">
        <div class="step-row" @click="toggle(i)">
          <span class="ico">{{
            s.status === 'success' ? '✓' : s.status === 'failed' ? '✕' : '–'
          }}</span>
          <span class="t">{{ s.type }}</span>
          <span class="spacer" />
          <span class="muted">{{ s.durationMs }}ms</span>
          <span v-if="hasOutput(s)" class="chev">{{ expanded.has(i) ? '▾' : '▸' }}</span>
        </div>
        <div v-if="s.error" class="err">{{ s.error }}</div>
        <pre v-if="expanded.has(i) && hasOutput(s)" class="output">{{ format(s.output) }}</pre>
      </li>
    </ul>

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
.trigger {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0.5rem 0;
  font-size: 0.75rem;
}
.trigger code {
  background: var(--bg);
  padding: 0 3px;
  border-radius: 3px;
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
  padding: 0.3rem 0.5rem;
  background: var(--surface);
  border-radius: 6px;
}
.step-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
}
.chev {
  font-size: 0.7rem;
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
  color: var(--danger);
  font-size: 0.75rem;
  margin-top: 0.25rem;
}
.output {
  margin: 0.4rem 0 0;
  padding: 0.4rem;
  background: var(--bg);
  border-radius: 4px;
  font-size: 0.7rem;
  max-height: 160px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
.link {
  background: none;
  padding: 0.2rem 0;
  color: var(--primary);
  text-align: left;
  width: 100%;
}
button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>