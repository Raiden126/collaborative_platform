<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStore } from '@/store';
import { PERMISSIONS } from '@cwb/shared';

const store = useStore();
const router = useRouter();

const user = computed(() => store.state.auth.user);
const online = computed(() => store.state.offline.online);
const pending = computed(() => store.state.offline.pending);

const nav = [
  { to: '/dashboard', label: 'Dashboard', perm: PERMISSIONS.ANALYTICS_VIEW },
  { to: '/workflows', label: 'Workflows', perm: PERMISSIONS.WORKFLOW_VIEW },
  { to: '/activity', label: 'Activity', perm: PERMISSIONS.WORKFLOW_VIEW },
];

onMounted(() => {
  // Connect realtime + warm the permission catalogue once authenticated.
  store.dispatch('realtime/connect');
  store.dispatch('permissions/loadCatalogue');
});

async function logout() {
  await store.dispatch('auth/logout');
  store.dispatch('realtime/disconnect');
  router.push({ name: 'login' });
}
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">⚡ Workflow Builder</div>
      <nav>
        <router-link v-for="item in nav" :key="item.to" v-can="item.perm" :to="item.to">
          {{ item.label }}
        </router-link>
      </nav>
      <div class="spacer" />
      <div class="status">
        <span class="dot" :class="{ on: online }" /> {{ online ? 'Online' : 'Offline' }}
        <span v-if="pending" class="badge">{{ pending }} queued</span>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="spacer" />
        <div class="row" v-if="user">
          <span class="muted">{{ user.name }}</span>
          <span class="badge">{{ user.roles.join(', ') }}</span>
          <button @click="logout">Logout</button>
        </div>
      </header>
      <main class="content">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100%;
}
.sidebar {
  width: 220px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 1rem;
  gap: 0.5rem;
}
.brand {
  font-weight: 700;
  margin-bottom: 1rem;
}
nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
nav a {
  padding: 0.5rem 0.6rem;
  border-radius: var(--radius);
  color: var(--text);
}
nav a.router-link-active {
  background: var(--primary);
  color: #fff;
}
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.topbar {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
}
.content {
  flex: 1;
  overflow: auto;
  padding: 1.25rem;
}
.status {
  font-size: 0.8rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--danger);
}
.dot.on {
  background: var(--success);
}
@media (max-width: 720px) {
  .sidebar {
    width: 64px;
  }
  .brand,
  nav a span {
    display: none;
  }
}
</style>
