<script setup lang="ts">
import { useNotificationsStore } from '@/stores/notifications/notifications.store'
import { appNotificationsTexts as text } from './AppNotifications.texts'

const notifications = useNotificationsStore()
</script>

<template>
  <Teleport to="body">
    <div class="notification-region" role="status" aria-live="polite" aria-atomic="true" :aria-label="text.region">
      <Transition name="notification">
        <div v-if="notifications.current" :key="notifications.current.id" class="notification">
          <p>{{ notifications.current.message }}</p>
          <button type="button" :aria-label="text.close" @click="notifications.dismiss(notifications.current?.id)">{{ text.closeIcon }}</button>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.notification-region { position: fixed; top: 24px; right: 24px; width: min(400px, calc(100% - 36px)); z-index: 2000; pointer-events: none; }
.notification { display: flex; align-items: flex-start; gap: 16px; padding: 18px 20px; background: #e8efdf; color: var(--color-text); border: 1px solid var(--color-focus); box-shadow: 0 8px 30px #0002; pointer-events: auto; }
p { margin: 0; line-height: 1.5; overflow-wrap: anywhere; flex: 1; }
button { flex: none; padding: 0; border: 0; color: inherit; background: transparent; font-size: 24px; line-height: 1; }
.notification-enter-active, .notification-leave-active { transition: opacity .15s, transform .15s; }
.notification-leave-active { pointer-events: none; }
.notification-enter-from, .notification-leave-to { opacity: 0; transform: translateY(-8px); }
@media (max-width: 600px) { .notification-region { top: 18px; right: 18px; } }
@media (prefers-reduced-motion: reduce) { .notification-enter-active, .notification-leave-active { transition: none; } }
</style>
