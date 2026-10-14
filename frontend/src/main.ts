import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import './styles.css'
import { useAuthStore } from './stores/auth.store'
import { watchSessionNavigation } from './router/session-navigation'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
const stopSessionNavigation = watchSessionNavigation(router, pinia)
app.onUnmount(stopSessionNavigation)
void useAuthStore(pinia).restoreSession()
app.use(router)

app.mount('#app')
