<script setup lang="ts">
import AppNotifications from '@/components/common/AppNotifications/AppNotifications.vue'
import { RouterView } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader/AppHeader.vue'
import AppFooter from '@/components/layout/AppFooter/AppFooter.vue'
import SessionMessages from '@/components/auth/SessionMessages/SessionMessages.vue'
</script>

<template>
  <AppNotifications />
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

@media (width <= 600px) {
  .app-container {
    width: calc(100% - 36px);
  }
}
</style>
