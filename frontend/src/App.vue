<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppFooter from '@/components/layout/AppFooter.vue'
import SessionMessages from '@/components/auth/SessionMessages.vue'
</script>

<template>
  <AppHeader class="app-container" />
  <main class="app-container">
    <SessionMessages />
    <RouterView />
  </main>
  <AppFooter class="app-container" />
</template>

<style scoped>
.app-container {
  width: min(1280px, calc(100% - 96px));
  margin-inline: auto;
}

@media (max-width: 600px) {
  .app-container {
    width: calc(100% - 36px);
  }
}
</style>
