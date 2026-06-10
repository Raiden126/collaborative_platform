<script setup lang="ts">
// Example plugin node component — identical contract to built-in nodes.
import BaseNode from '@/builder/nodes/BaseNode.vue';
</script>
<template>
  <BaseNode v-bind="$attrs" type="slack" />
</template>
