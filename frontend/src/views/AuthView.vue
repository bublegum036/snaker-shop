<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { register } from '@/api/auth.api'
import { ApiError } from '@/api/http.client'
import { useAuthStore } from '@/stores/auth.store'

const props = defineProps<{ mode: 'login' | 'register' }>()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const email = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)
const registered = ref(false)
const isRegister = computed(() => props.mode === 'register')
const disabled = computed(() => submitting.value || auth.busy || auth.initializing || !!auth.sessionError)
let request: AbortController | undefined

function resetForm() {
  request?.abort()
  request = undefined
  password.value = ''
  error.value = ''
  registered.value = false
  submitting.value = false
}
watch(() => props.mode, resetForm)
onBeforeUnmount(resetForm)

async function submit() {
  if (disabled.value) return
  error.value = ''
  // bcrypt ограничен байтами UTF-8: 72 кириллических символа уже не поместятся.
  if (new TextEncoder().encode(password.value).length > 72 || password.value.includes('\0')) {
    error.value = 'Пароль должен занимать не более 72 байт UTF-8 и не содержать нулевой символ.'
    return
  }
  submitting.value = true
  request = new AbortController()
  const current = request
  const registration = isRegister.value
  const credentials = { email: email.value.trim().toLowerCase(), password: password.value }
  try {
    if (registration) {
      await register(credentials, current.signal)
      if (!current.signal.aborted) registered.value = true
    } else if (await auth.login(credentials, current.signal)) {
      const next = route.query.next
      // Разрешены только известные страницы приложения, внешние адреса не принимаем.
      const name = next === 'catalog' || next === 'cart' ? next : 'account'
      await router.replace({ name })
    }
  } catch (cause) {
    if (current.signal.aborted) return
    if (cause instanceof ApiError && cause.status === 401) error.value = 'Неверный email или пароль.'
    else if (cause instanceof ApiError && cause.status === 409) error.value = 'Этот email уже зарегистрирован. Войдите в аккаунт.'
    else if (cause instanceof ApiError && cause.status === 422) error.value = 'Проверьте email и пароль: от 8 символов и не более 72 байт UTF-8.'
    else error.value = cause instanceof Error ? cause.message : 'Не удалось выполнить запрос.'
  } finally {
    credentials.password = ''
    if (request === current) {
      password.value = ''
      submitting.value = false
    }
  }
}
</script>

<template>
  <section class="auth-page" aria-labelledby="auth-title">
    <p class="eyebrow">Личный кабинет</p>
    <h1 id="auth-title">{{ isRegister ? 'Регистрация' : 'Вход' }}</h1>
    <div v-if="registered" class="auth-success" role="status">
      <p>Аккаунт {{ email }} создан. Теперь войдите с вашим паролем.</p>
      <RouterLink class="primary-button" :to="{ name: 'login', query: route.query }">Перейти ко входу</RouterLink>
    </div>
    <form v-else class="auth-form" @submit.prevent="submit">
      <p>{{ isRegister ? 'Создайте аккаунт для покупок в магазине.' : 'Войдите в свой аккаунт.' }}</p>
      <fieldset :disabled="disabled">
        <legend class="visually-hidden">Учётные данные</legend>
        <label>Email
          <input v-model.trim="email" type="email" autocomplete="username" required placeholder="you@example.com">
        </label>
        <label>Пароль
          <input v-model="password" type="password" :autocomplete="isRegister ? 'new-password' : 'current-password'" minlength="8" maxlength="72" required aria-describedby="password-hint">
        </label>
        <p id="password-hint" class="hint-text">От 8 символов, не более 72 байт UTF-8.</p>
        <p v-if="error" class="error-text" role="alert">{{ error }}</p>
        <button type="submit" class="primary-button">{{ submitting ? 'Отправляем…' : isRegister ? 'Зарегистрироваться' : 'Войти' }}</button>
      </fieldset>
      <p class="auth-switch">
        {{ isRegister ? 'Уже есть аккаунт?' : 'Нет аккаунта?' }}
        <RouterLink :to="{ name: isRegister ? 'login' : 'register', query: route.query }">{{ isRegister ? 'Войти' : 'Зарегистрироваться' }}</RouterLink>
      </p>
    </form>
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

.auth-form {
  margin-top: 30px;
}

.auth-form > p, .auth-success p {
  line-height: 1.6;
  color: var(--color-muted);
}

.auth-form fieldset {
  border: 0;
  padding: 0;
  margin: 26px 0;
  min-width: 0;
}

.auth-form label {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-top: 20px;
  font-size: 14px;
}

.auth-switch a {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.auth-success {
  margin-top: 30px;
}

.auth-success a {
  display: inline-block;
  margin-top: 12px;
}
</style>
