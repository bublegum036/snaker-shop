<script setup lang="ts">
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
</script>

<template>
  <div v-if="auth.notice" class="session-message" role="status">{{ auth.notice }}</div>
  <div v-if="auth.sessionError" class="session-message" role="alert">
    <p>{{ auth.sessionError }}</p>
    <button type="button" class="secondary-button" :disabled="auth.initializing" @click="auth.restoreSession()">
      Повторить проверку входа
    </button>
    <button type="button" class="text-button" @click="auth.logout()">Выйти из сессии</button>
  </div>
</template>

<style scoped>
.session-message {
  padding: 18px;
  margin-top: 24px;
  background: #e8ebe3;
  font-size: 14px;
  line-height: 1.5;
}

.session-message button + button {
  margin-left: 16px;
}
</style>
