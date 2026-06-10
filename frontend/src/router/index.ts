import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { PERMISSIONS } from '@cwb/shared';
import { store } from '@/store';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true },
  },
  { path: '/', redirect: '/dashboard' },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { permission: PERMISSIONS.ANALYTICS_VIEW },
  },
  {
    path: '/workflows',
    name: 'workflows',
    component: () => import('@/views/WorkflowsView.vue'),
    meta: { permission: PERMISSIONS.WORKFLOW_VIEW },
  },
  {
    path: '/workflows/:id',
    name: 'builder',
    component: () => import('@/views/BuilderView.vue'),
    meta: { permission: PERMISSIONS.WORKFLOW_VIEW },
    props: true,
  },
  {
    path: '/activity',
    name: 'activity',
    component: () => import('@/views/ActivityView.vue'),
    meta: { permission: PERMISSIONS.WORKFLOW_VIEW },
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

/** Route guard: enforce authentication and per-route permissions (features 1 & 16). */
router.beforeEach(async (to) => {
  if (to.meta.public) return true;

  if (!store.getters['auth/isAuthenticated']) {
    const restored = await store.dispatch('auth/restore');
    if (!restored) return { name: 'login', query: { redirect: to.fullPath } };
  }

  const required = to.meta.permission as string | undefined;
  if (required && !store.getters['permissions/has'](required)) {
    store.dispatch('notifications/push', {
      type: 'ERROR',
      title: 'Access denied',
      message: `Missing permission: ${required}`,
    });
    return { name: 'dashboard' };
  }
  return true;
});
