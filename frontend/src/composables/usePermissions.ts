import { computed } from 'vue';
import { useStore } from '@/store';

/** Reactive permission checks for use inside <script setup>. */
export function usePermissions() {
  const store = useStore();
  const can = (key: string) => store.getters['permissions/has'](key) as boolean;
  const canAny = (keys: string[]) => store.getters['permissions/hasAny'](keys) as boolean;
  const permissions = computed(() => store.getters['auth/permissions'] as string[]);
  return { can, canAny, permissions };
}
