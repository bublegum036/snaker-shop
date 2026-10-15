<script setup lang="ts">
import { productCartFormTexts as text } from './ProductCartForm.texts'
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import type { Product } from '@/api/catalog.api'
import { useAuthStore } from '@/stores/auth/auth.store'
import { useCartStore } from '@/stores/cart/cart.store'

const props = defineProps<{ product: Product }>()
const auth = useAuthStore()
const cart = useCartStore()
const sizeId = ref<number | null>(null)
const quantity = ref<number | ''>(1)
const error = ref('')
const selectedSize = computed(() => props.product.sizes.find((size) => size.id === sizeId.value))
const remaining = computed(() => {
  const item = cart.data?.items.find((row) => row.product_size_id === sizeId.value)
  const stock = item?.stock ?? selectedSize.value?.stock ?? 0
  return Math.max(0, stock - (item?.quantity ?? 0))
})
const busy = computed(() => cart.loading || cart.mutating || cart.checkoutPending || auth.initializing)
const canAdd = computed(() => !busy.value && !!cart.data && !cart.error && (selectedSize.value?.stock ?? 0) > 0 && remaining.value > 0)

watch([sizeId, () => auth.accessToken], () => {
  quantity.value = 1
  error.value = ''
})
watch(() => cart.data, (data) => {
  if (data) { error.value = '' }
})

async function add() {
  if (!canAdd.value || sizeId.value === null) { return }
  error.value = ''
  if (typeof quantity.value !== 'number' || !Number.isInteger(quantity.value) || quantity.value < 1 || quantity.value > remaining.value) {
    error.value = text.invalidQuantity
    return
  }
  try {
    if (await cart.addItem(sizeId.value, quantity.value)) {
      sizeId.value = null
      quantity.value = 1
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : text.addFailed
  }
}
</script>

<template>
  <form class="product-cart-form" :aria-label="text.addLabel(product.name)" @submit.prevent="add">
    <div v-if="product.sizes.length" class="product-options">
      <fieldset :disabled="busy">
        <legend>{{ text.size }}</legend>
        <div class="size-options">
          <label v-for="size in product.sizes" :key="size.id" :class="{ unavailable: size.stock === 0 }">
            <input v-model="sizeId" type="radio" :name="`size-${product.id}`" :value="size.id" :disabled="size.stock === 0">
            <span>{{ Number(size.size) }}{{ size.stock === 0 ? text.unavailableSize : '' }}</span>
          </label>
        </div>
      </fieldset>
      <label v-if="auth.isAuthenticated" class="quantity-field">{{ text.quantity }}
        <input v-model="quantity" type="number" min="1" :max="remaining" step="1" required
          :disabled="busy || !selectedSize || !cart.data || remaining === 0">
      </label>
    </div>
    <p v-else class="hint-text">{{ text.noSizes }}</p>
    <template v-if="auth.isAuthenticated">
      <p v-if="product.sizes.length" class="hint-text availability-hint" role="status">
        {{ cart.loading ? text.checking : selectedSize && cart.data ? text.remaining(remaining) : text.chooseSize }}
      </p>
      <p v-if="cart.error" class="error-text" role="alert">{{ cart.error }}</p>
      <button v-if="!cart.data && !busy" type="button" class="text-button" @click="cart.loadCart()">{{ text.refresh }}</button>
      <button type="submit" class="primary-button" :disabled="!canAdd">{{ cart.mutating ? text.adding : text.add }}</button>
    </template>
    <RouterLink v-else-if="!auth.initializing" class="login-link" :to="{ name: 'login', query: { next: 'catalog' } }">{{ text.signIn }}</RouterLink>
    <p v-if="error && error !== cart.error" class="error-text" role="alert">{{ error }}</p>
  </form>
</template>

<style scoped>
.product-cart-form {
  margin-top: 18px;
  font-size: 13px;
}

.product-options {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 14px;
}

fieldset {
  flex: 1 1 140px;
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}

legend {
  color: var(--color-muted);
  margin-bottom: 9px;
}

.size-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.size-options label {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px;
  border: 1px solid #c8d0bf;
  cursor: pointer;
}

.size-options input {
  margin: 0;
  accent-color: var(--color-text);
}

.size-options label:has(input:checked) {
  background: #e8ebe3;
  border-color: var(--color-text);
}

.size-options .unavailable {
  opacity: .55;
  cursor: default;
}

.quantity-field {
  display: flex;
  flex: 0 0 90px;
  flex-direction: column;
  gap: 9px;
  min-width: 0;
  color: var(--color-muted);
}

.quantity-field input {
  width: 100%;
  min-height: 36px;
  padding: 7px;
  color: var(--color-text);
}

.availability-hint {
  min-height: 1.5em;
  line-height: 1.5;
  margin: 0 0 14px;
}

.primary-button {
  width: 100%;
}

.login-link, p a {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.login-link {
  display: inline-block;
  line-height: 1.5;
}
</style>
