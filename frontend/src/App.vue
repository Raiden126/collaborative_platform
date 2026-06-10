<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppLayout from '@/components/AppLayout.vue';
import NotificationToaster from '@/components/NotificationToaster.vue';

const route = useRoute();
// Login renders bare; everything else inside the authenticated layout.
const bare = computed(() => route.meta.public === true);
</script>

<template>
  <NotificationToaster />
  <router-view v-if="bare" />
  <AppLayout v-else>
    <router-view />
  </AppLayout>
</template>
