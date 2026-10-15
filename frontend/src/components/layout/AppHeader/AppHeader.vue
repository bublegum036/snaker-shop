<script setup lang="ts">
import { appHeaderTexts as text } from './AppHeader.texts'
import { RouterLink } from 'vue-router'
import { useSessionActions } from '@/composables/auth/useSessionActions/useSessionActions'
import { useAuthStore } from '@/stores/auth/auth.store'
import CartLink from '@/components/cart/CartLink/CartLink.vue'

const auth = useAuthStore()
const { logout } = useSessionActions()
</script>

<template>
  <header class="site-header">
    <RouterLink class="wordmark" to="/" :aria-label="text.homeLabel">{{ text.wordmark }}<span>{{ text.trademark }}</span></RouterLink>
    <nav :aria-label="text.navigation"><RouterLink to="/">{{ text.catalog }}</RouterLink></nav>
    <div class="header-account">
      <span v-if="auth.initializing" class="hint-text" role="status">{{ text.checking }}</span>
      <template v-else-if="auth.isAuthenticated">
        <RouterLink v-if="auth.user?.is_admin" :to="{ name: 'admin-products' }">{{ text.adminProducts }}</RouterLink>
        <RouterLink v-if="auth.user?.is_admin" :to="{ name: 'admin-orders' }">{{ text.adminOrders }}</RouterLink>
        <CartLink />
        <RouterLink :to="{ name: 'orders' }">{{ text.orders }}</RouterLink>
        <RouterLink class="account-link" :to="{ name: 'account' }">{{ auth.user?.email }}</RouterLink>
        <button type="button" class="text-button" @click="logout">{{ text.logout }}</button>
      </template>
      <template v-else>
        <RouterLink :to="{ name: 'login' }">{{ text.login }}</RouterLink>
        <RouterLink :to="{ name: 'register' }">{{ text.register }}</RouterLink>
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
  flex-wrap: wrap;
  font-size: 13px;
  min-width: 0;
}

.account-link {
  overflow-wrap: anywhere;
}

@media (width <= 1000px) {
  .site-header {
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
    padding-block: 16px;
  }

  .header-account {
    width: 100%;
    justify-content: space-between;
  }
}

@media (width <= 600px) {
  .wordmark {
    font-size: 34px;
  }
}
</style>
