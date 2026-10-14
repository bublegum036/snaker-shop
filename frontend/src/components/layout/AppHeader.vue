<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
</script>

<template>
  <header class="site-header">
    <RouterLink class="wordmark" to="/" aria-label="North — главная">north<span>®</span></RouterLink>
    <nav aria-label="Основная навигация"><RouterLink to="/">Каталог</RouterLink></nav>
    <div class="header-account">
      <span v-if="auth.initializing" class="hint-text" role="status">Проверяем вход…</span>
      <template v-else-if="auth.isAuthenticated">
        <RouterLink class="account-link" :to="{ name: 'account' }">{{ auth.user?.email }}</RouterLink>
        <button type="button" class="text-button" @click="auth.logout()">Выйти</button>
      </template>
      <template v-else>
        <RouterLink :to="{ name: 'login' }">Войти</RouterLink>
        <RouterLink :to="{ name: 'register' }">Регистрация</RouterLink>
      </template>
    </div>
  </header>
</template>

<style scoped>
.site-header {
  min-height: 100px;
  display: flex;
  align-items: center;
  gap: 80px;
  border-bottom: 1px solid var(--color-border);
}

.wordmark {
  font-size: 40px;
  font-weight: 850;
  letter-spacing: -3px;
}

.wordmark span {
  font-size: 15px;
  vertical-align: top;
  letter-spacing: 0;
}

nav {
  font-size: 14px;
  font-weight: 600;
}

.header-account {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 20px;
  font-size: 13px;
  min-width: 0;
}

.account-link {
  overflow-wrap: anywhere;
}

@media (max-width: 600px) {
  .site-header {
    min-height: 76px;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
    padding-block: 16px;
  }

  .wordmark {
    font-size: 34px;
  }

  .header-account {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
