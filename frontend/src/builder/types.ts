import type { Component } from 'vue';

/** Field descriptor consumed by the dynamic form engine (feature 12). */
export type FieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'date'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'multiselect'
  | 'textarea';

export interface FormField {
  name: string;
  label: string;
  fieldType: FieldType;
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  default?: unknown;
}

/** A registered node type. Built-ins and plugins share this contract (features 4 & 20). */
export interface NodeDefinition {
  type: string;
  label: string;
  category: 'Trigger' | 'Logic' | 'Action' | 'Integration';
  icon: string;
  color: string;
  /** Async-loaded canvas component — never imported via a switch statement. */
  component: Component | (() => Promise<unknown>);
  /** Default `data` for a freshly dropped node. */
  defaultData?: Record<string, unknown>;
  /** Backend-driveable form schema describing this node's `data`. */
  form: FormField[];
  /** true for the entry node (no inbound handle). */
  isTrigger?: boolean;
}
