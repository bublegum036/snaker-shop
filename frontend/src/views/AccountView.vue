<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
const loading = ref(false)
const error = ref('')

async function refresh() {
  loading.value = true
  error.value = ''
  try { await auth.refreshProfile() }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Не удалось обновить профиль.'
  } finally { loading.value = false }
}
</script>

<template>
  <section v-if="auth.user" class="auth-page" aria-labelledby="account-title">
    <p class="eyebrow">Личный кабинет</p>
    <h1 id="account-title">Ваш профиль</h1>
    <dl class="profile-details">
      <div><dt>Email</dt><dd>{{ auth.user.email }}</dd></div>
      <div><dt>Номер пользователя</dt><dd>{{ auth.user.id }}</dd></div>
      <div><dt>Роль</dt><dd>{{ auth.user.is_admin ? 'Администратор' : 'Покупатель' }}</dd></div>
    </dl>
    <p v-if="error" class="error-text" role="alert">{{ error }}</p>
    <button type="button" class="secondary-button" :disabled="loading" @click="refresh">{{ loading ? 'Обновляем…' : 'Обновить профиль' }}</button>
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
