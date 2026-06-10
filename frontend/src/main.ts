import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import { store, key } from './store';
import { vCan } from './directives/can';
import { setAuthLostHandler } from './api/http';
import '@/builder/nodeRegistry'; // registers built-in node types
import { registerPlugins } from '@/plugins';
import './styles/main.css';

// Load plugin-provided node types (feature 20) before mount.
registerPlugins();

const app = createApp(App);

app.use(store, key);
app.use(router);
app.directive('can', vCan);

// When refresh fails, clear the session and bounce to login.
setAuthLostHandler(() => {
  store.commit('auth/clear');
  if (router.currentRoute.value.name !== 'login') {
    router.push({ name: 'login' });
  }
});

// Initialize offline connectivity listeners early.
store.dispatch('offline/init');

app.mount('#app');
