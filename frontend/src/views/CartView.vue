<script setup lang="ts">
import { RouterLink } from 'vue-router'
import CartLine from '@/components/cart/CartLine.vue'
import { useCartStore } from '@/stores/cart.store'
import { formatPrice } from '@/utils/format-price'

const cart = useCartStore()
</script>

<template>
  <section class="cart-page" aria-labelledby="cart-title">
    <div class="cart-heading">
      <h1 id="cart-title">Корзина</h1>
      <button type="button" class="text-button" :disabled="cart.loading || cart.mutating" @click="cart.loadCart()">Обновить корзину ↗</button>
    </div>
    <p v-if="cart.loading" class="hint-text" role="status">Загружаем корзину…</p>
    <div v-if="cart.error" class="error-text" role="alert">
      <p>{{ cart.error }}</p>
      <button type="button" class="secondary-button" :disabled="cart.loading || cart.mutating" @click="cart.loadCart()">Повторить загрузку</button>
    </div>
    <template v-if="cart.data">
      <p v-if="cart.data.items.length === 0" class="empty-cart" role="status">Корзина пока пуста. Выберите свою пару в каталоге.</p>
      <ul v-else aria-label="Товары в корзине">
        <li v-for="item in cart.data.items" :key="item.id"><CartLine :item="item" /></li>
      </ul>
      <p class="cart-total">Предварительная сумма <strong>{{ formatPrice(cart.data.estimated_total) }}</strong></p>
      <p class="hint-text">Товары в корзине не резервируются. Наличие и цена проверяются при оформлении заказа.</p>
    </template>
    <RouterLink class="catalog-link" :to="{ name: 'catalog' }">← Вернуться в каталог</RouterLink>
  </section>
</template>

<style scoped>
.cart-page {
  max-width: 900px;
  margin: 64px auto;
}

.cart-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}

h1 {
  margin: 0;
  font-size: clamp(36px, 5vw, 56px);
  letter-spacing: -2px;
}

ul {
  list-style: none;
  padding: 0;
}

.empty-cart {
  padding-block: 40px;
}

.cart-total {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  font-size: 20px;
  margin-top: 32px;
}

.catalog-link {
  display: inline-block;
  margin-top: 30px;
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
