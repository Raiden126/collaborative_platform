<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStore } from '@/store';

const store = useStore();
const router = useRouter();
const route = useRoute();

const email = ref('admin@cwb.dev');
const password = ref('password123');
const loading = ref(false);

async function submit() {
  loading.value = true;
  const ok = await store.dispatch('auth/login', { email: email.value, password: password.value });
  loading.value = false;
  if (ok) {
    store.dispatch('realtime/connect');
    router.push((route.query.redirect as string) || '/dashboard');
  }
}
</script>

<template>
  <div class="login">
    <form class="card" @submit.prevent="submit">
      <h1>⚡ Workflow Builder</h1>
      <p class="muted">Sign in to continue</p>
      <label>Email<input v-model="email" type="email" autocomplete="username" /></label>
      <label>Password<input v-model="password" type="password" autocomplete="current-password" /></label>
      <p v-if="store.state.auth.error" class="error">{{ store.state.auth.error }}</p>
      <button class="btn-primary" :disabled="loading" type="submit">
        {{ loading ? 'Signing in…' : 'Sign in' }}
      </button>
      <p class="muted hint">Try admin@cwb.dev / editor@cwb.dev / viewer@cwb.dev — password123</p>
    </form>
  </div>
</template>

<style scoped>
.login {
  display: grid;
  place-items: center;
  height: 100%;
}
form {
  width: 360px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.85rem;
}
.error {
  color: var(--danger);
  font-size: 0.85rem;
}
.hint {
  font-size: 0.75rem;
}
</style>
