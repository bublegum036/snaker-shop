import { useAuthStore } from '@/stores/auth/auth.store'
import { useNotificationsStore } from '@/stores/notifications/notifications.store'
import { sessionActionsTexts as text } from './useSessionActions.texts'

export function useSessionActions() {
  const auth = useAuthStore()
  const notifications = useNotificationsStore()
  function logout() {
    auth.logout()
    notifications.success(text.loggedOut)
  }
  return { logout }
}
