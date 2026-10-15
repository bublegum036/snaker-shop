<script setup lang="ts">
import { cartLineTexts as text } from './CartLine.texts'
import type { CartItem } from '@/api/cart.api'
import { formatPrice } from '@/utils/format-price'
import CartItemActions from '@/components/cart/CartItemActions/CartItemActions.vue'

defineProps<{ item: CartItem }>()
</script>

<template>
  <article class="cart-line">
    <div>
      <h2>{{ item.name }}</h2>
      <p class="hint-text">{{ text.details(item.size, formatPrice(item.price)) }}</p>
      <p v-if="item.quantity > item.stock" class="error-text">{{ text.stockChanged(item.stock) }}</p>
      <CartItemActions :item="item" />
    </div>
    <span>{{ text.quantity(item.quantity) }}</span>
    <strong>{{ formatPrice(item.subtotal) }}</strong>
  </article>
</template>

<style scoped>
.cart-line {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 24px;
  padding: 24px 0;
  border-bottom: 1px solid var(--color-border);
}

h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

strong {
  white-space: nowrap;
}

@media (width <= 600px) {
  .cart-line {
    grid-template-columns: 1fr auto;
    gap: 12px;
  }

  .cart-line > div {
    grid-column: 1 / -1;
  }
}
</style>
