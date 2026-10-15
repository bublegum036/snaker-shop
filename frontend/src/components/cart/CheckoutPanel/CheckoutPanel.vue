<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { computed, ref, watch } from 'vue'
import ConfirmDialog from '@/components/common/ConfirmDialog/ConfirmDialog.vue'
import { useCartStore } from '@/stores/cart/cart.store'
import { formatPrice } from '@/utils/format-price'
import { checkoutPanelTexts as text } from './CheckoutPanel.texts'

const cart = useCartStore()
const confirming = ref(false)
const submitting = ref(false)
const confirmationTotal = ref('')
const canSubmit = computed(() => !cart.loading && !cart.mutating && (
  cart.checkoutPending || (!!cart.data?.items.length && !cart.error)
))

async function requestCheckout() {
  if (!canSubmit.value) return
  if (cart.checkoutPending) await submitOrder()
  else { confirmationTotal.value = formatPrice(cart.data!.estimated_total); confirming.value = true }
}
function cancelCheckout() { if (!cart.mutating) confirming.value = false }
async function submitOrder() {
  submitting.value = true
  try { await cart.placeOrder() }
  finally { submitting.value = false; confirming.value = false }
}
async function confirmCheckout() {
  if (confirming.value && canSubmit.value) await submitOrder()
}
watch(() => cart.data, (data) => { if (!data && !cart.mutating) confirming.value = false })
</script>

<template>
  <div class="checkout-panel">
    <p v-if="cart.checkoutPending" class="hint-text" role="status">{{ text.pending }}</p>
    <p v-if="cart.checkoutError" class="error-text" role="alert">{{ cart.checkoutError }}</p>
    <button type="button" class="primary-button" :disabled="!canSubmit" @click="requestCheckout">
      {{ submitting ? text.busy : cart.checkoutPending ? text.repeat : text.submit }}
    </button>
    <ConfirmDialog v-if="confirming" :title="text.confirmTitle" :message="text.confirmMessage(confirmationTotal)"
      :confirm-text="text.submit" :pending-text="text.busy" :busy="cart.mutating" :confirm-disabled="!canSubmit" @confirm="confirmCheckout" @cancel="cancelCheckout" />
    <section v-if="cart.order" class="order-result" role="status">
      <h2>{{ text.result(cart.order.id) }}</h2>
      <dl>
        <dt>{{ text.total }}</dt><dd>{{ formatPrice(cart.order.total) }}</dd>
        <dt>{{ text.status }}</dt><dd>{{ cart.order.status === 'created' ? text.created : cart.order.status }}</dd>
        <dt>{{ text.items }}</dt><dd>{{ cart.order.items.length }}</dd>
      </dl>
      <RouterLink class="order-link" :to="{ name: 'order-details', params: { orderId: cart.order.id } }">{{ text.openOrder }}</RouterLink>
    </section>
  </div>
</template>

<style scoped>
.checkout-panel { margin-top: 24px; }
.order-result { margin-top: 24px; padding: 20px; border: 1px solid var(--color-text); }
h2 { margin-top: 0; }
.order-link { text-decoration: underline; text-underline-offset: 3px; }
dl { display: grid; grid-template-columns: 1fr auto; gap: 12px; }
dd { margin: 0; }
@media (max-width: 480px) {
  dl { grid-template-columns: 1fr; gap: 6px; }
  dd { margin-bottom: 12px; }
}
</style>
