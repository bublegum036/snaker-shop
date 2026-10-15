<script setup lang="ts">
import { accountViewTexts as text } from './AccountView.texts'
import { useRoute } from 'vue-router'
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth/auth.store'

const auth = useAuthStore()
const route = useRoute()
const loading = ref(false)
const error = ref('')

async function refresh() {
  loading.value = true
  error.value = ''
  try { await auth.refreshProfile() }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : text.refreshFailed
  } finally { loading.value = false }
}
</script>

<template>
  <section v-if="auth.user" class="auth-page" aria-labelledby="account-title">
    <p class="eyebrow">{{ text.account }}</p>
    <h1 id="account-title">{{ text.title }}</h1>
    <p v-if="route.query.access === 'admin-required'" class="error-text" role="alert">{{ text.adminRequired }}</p>
    <dl class="profile-details">
      <div><dt>{{ text.email }}</dt><dd>{{ auth.user.email }}</dd></div>
      <div><dt>{{ text.userId }}</dt><dd>{{ auth.user.id }}</dd></div>
      <div><dt>{{ text.role }}</dt><dd>{{ auth.user.is_admin ? text.admin : text.customer }}</dd></div>
    </dl>
    <p v-if="error" class="error-text" role="alert">{{ error }}</p>
    <button type="button" class="secondary-button" :disabled="loading" @click="refresh">{{ loading ? text.loading : text.refresh }}</button>
  </section>
</template>

<style scoped>
.auth-page {
  max-width: 520px;
  margin: 64px auto;
}

.auth-page h1 {
  font-size: clamp(34px, 5vw, 56px);
  letter-spacing: -2px;
  margin: 0;
  font-weight: 650;
  line-height: .98;
}

.profile-details {
  margin: 36px 0;
}

.profile-details div {
  padding: 16px 0;
  border-bottom: 1px solid var(--color-border);
}

.profile-details dt {
  font-size: 12px;
  color: var(--color-muted);
  margin-bottom: 8px;
}

.profile-details dd {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
