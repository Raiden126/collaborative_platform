import type { Directive } from 'vue';
import { store } from '@/store';

/**
 * `v-can` — hide or disable an element based on a permission key (feature 1).
 *   <button v-can="'workflow.publish'">Publish</button>          // removed if no permission
 *   <button v-can.disable="'workflow.publish'">Publish</button>  // disabled instead of removed
 */
export const vCan: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    apply(el, binding.value, binding.modifiers.disable);
  },
  updated(el, binding) {
    apply(el, binding.value, binding.modifiers.disable);
  },
};

function apply(el: HTMLElement, permission: string, disableMode?: boolean) {
  const allowed = store.getters['permissions/has'](permission);
  if (allowed) {
    el.style.removeProperty('display');
    el.removeAttribute('disabled');
    el.removeAttribute('aria-disabled');
    return;
  }
  if (disableMode) {
    el.setAttribute('disabled', 'true');
    el.setAttribute('aria-disabled', 'true');
    el.style.opacity = '0.5';
    el.style.pointerEvents = 'none';
  } else {
    el.style.display = 'none';
  }
}
