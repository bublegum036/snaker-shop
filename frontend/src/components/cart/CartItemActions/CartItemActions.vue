<script setup lang="ts">
import { cartItemActionsTexts as text } from './CartItemActions.texts'
import { computed, ref, watch } from 'vue'
import type { CartItem } from '@/api/cart.api'
import { useCartStore } from '@/stores/cart/cart.store'

const props = defineProps<{ item: CartItem }>()
const cart = useCartStore()
const quantity = ref<number | ''>(props.item.quantity)
const error = ref('')
const busy = computed(() => cart.loading || cart.mutating)

watch(() => props.item.quantity, (value) => {
  quantity.value = value
  error.value = ''
})

async function save() {
  error.value = ''
  if (busy.value || quantity.value === props.item.quantity) return
  if (typeof quantity.value !== 'number' || !Number.isInteger(quantity.value) || quantity.value < 1 || quantity.value > props.item.stock) {
    error.value = text.invalidQuantity
    return
  }
  try { await cart.updateItem(props.item.id, quantity.value) }
  catch { /* Серверная ошибка показана страницей через cart.error. */ }
}

async function remove() {
  if (busy.value) return
  try { await cart.removeItem(props.item.id) }
  catch { /* Серверная ошибка показана страницей через cart.error. */ }
}
</script>

<template>
  <div class="cart-item-actions">
    <form :aria-label="text.quantityLabel(item.name, item.size)" @submit.prevent="save">
      <label>{{ text.quantity }}
        <input v-model="quantity" type="number" min="1" :max="item.stock" step="1" required :disabled="busy || item.stock === 0">
      </label>
      <button type="submit" class="secondary-button" :disabled="busy || item.stock === 0 || quantity === item.quantity">{{ text.save }}</button>
    </form>
    <button type="button" class="text-button remove-button" :disabled="busy" :aria-label="text.removeLabel(item.name, item.size)" @click="remove">{{ text.remove }}</button>
    <p v-if="error" class="error-text" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.cart-item-actions {
  margin-top: 12px;
}

form, label {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

label {
  font-size: 12px;
}

input {
  width: 80px;
  padding: 8px;
}

.secondary-button {
  padding: 8px 12px;
  font-size: 12px;
}

.remove-button {
  color: var(--color-error);
}
</style>
