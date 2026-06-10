<script setup lang="ts">
import { computed } from 'vue';
import type { FormField } from '@/builder/types';

/**
 * Backend-driven form engine (feature 12). Renders any field schema with no
 * per-form code. `modelValue` is the data object keyed by field name.
 */
const props = defineProps<{ schema: FormField[]; modelValue: Record<string, unknown> }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: Record<string, unknown>): void }>();

const model = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

function update(name: string, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [name]: value });
}
function toggleMulti(name: string, value: string, checked: boolean) {
  const current = new Set((props.modelValue[name] as string[]) ?? []);
  checked ? current.add(value) : current.delete(value);
  update(name, [...current]);
}
</script>

<template>
  <form class="dyn-form" @submit.prevent>
    <div v-for="f in schema" :key="f.name" class="field">
      <label :for="f.name">{{ f.label }}<span v-if="f.required" class="req">*</span></label>

      <template v-if="['text', 'email', 'number', 'date'].includes(f.fieldType)">
        <input
          :id="f.name"
          :type="f.fieldType"
          :placeholder="f.placeholder"
          :value="model[f.name] ?? ''"
          @input="update(f.name, ($event.target as HTMLInputElement).value)"
        />
      </template>

      <textarea
        v-else-if="f.fieldType === 'textarea'"
        :id="f.name"
        :placeholder="f.placeholder"
        :value="(model[f.name] as string) ?? ''"
        rows="3"
        @input="update(f.name, ($event.target as HTMLTextAreaElement).value)"
      />

      <select
        v-else-if="f.fieldType === 'select'"
        :id="f.name"
        :value="model[f.name] ?? ''"
        @change="update(f.name, ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>

      <label v-else-if="f.fieldType === 'checkbox'" class="inline">
        <input
          type="checkbox"
          :checked="!!model[f.name]"
          @change="update(f.name, ($event.target as HTMLInputElement).checked)"
        />
        {{ f.placeholder }}
      </label>

      <div v-else-if="f.fieldType === 'radio'" class="options">
        <label v-for="o in f.options" :key="o.value" class="inline">
          <input
            type="radio"
            :name="f.name"
            :value="o.value"
            :checked="model[f.name] === o.value"
            @change="update(f.name, o.value)"
          />
          {{ o.label }}
        </label>
      </div>

      <div v-else-if="f.fieldType === 'multiselect'" class="options">
        <label v-for="o in f.options" :key="o.value" class="inline">
          <input
            type="checkbox"
            :value="o.value"
            :checked="((model[f.name] as string[]) ?? []).includes(o.value)"
            @change="toggleMulti(f.name, o.value, ($event.target as HTMLInputElement).checked)"
          />
          {{ o.label }}
        </label>
      </div>
    </div>
  </form>
</template>

<style scoped>
.dyn-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.85rem;
}
.req {
  color: var(--danger);
  margin-left: 2px;
}
.inline {
  flex-direction: row;
  align-items: center;
  gap: 0.4rem;
}
.inline input {
  width: auto;
}
.options {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
</style>
