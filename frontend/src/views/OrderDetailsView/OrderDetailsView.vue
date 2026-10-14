<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useOrderDetails } from '@/composables/orders/useOrderDetails/useOrderDetails'
import OrderSummary from '@/components/orders/OrderSummary/OrderSummary.vue'
import { formatPrice } from '@/utils/format-price'
import { orderDetailsViewTexts as text } from './OrderDetailsView.texts'

const props = defineProps<{ orderId: string }>()
const { order, loading, error, load } = useOrderDetails(() => props.orderId)
</script>

<template>
  <section class="order-page" aria-labelledby="order-title">
    <div class="page-heading">
      <h1 id="order-title">{{ text.title }}</h1>
      <button type="button" class="text-button" :disabled="loading" @click="load">{{ text.refresh }}</button>
    </div>
    <p v-if="loading" class="hint-text" role="status">{{ text.loading }}</p>
    <div v-else-if="error" class="error-text" role="alert">
      <p>{{ error }}</p>
      <button type="button" class="secondary-button" @click="load">{{ text.retry }}</button>
    </div>
    <template v-else-if="order">
      <div class="summary"><OrderSummary :order="order" /></div>
      <h2>{{ text.items }}</h2>
      <ul>
        <li v-for="(item, index) in order.items" :key="item.id">
          <h3>{{ text.position(index) }}</h3>
          <dl>
            <dt>{{ text.sizeCode }}</dt><dd>{{ item.product_size_id }}</dd>
            <dt>{{ text.quantity }}</dt><dd>{{ item.quantity }}</dd>
            <dt>{{ text.price }}</dt><dd>{{ formatPrice(item.price_at_purchase) }}</dd>
          </dl>
        </li>
      </ul>
    </template>
    <RouterLink class="back-link" :to="{ name: 'orders' }">{{ text.back }}</RouterLink>
  </section>
</template>

<style scoped>
.order-page { max-width: 900px; margin: 64px auto; }
.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
h1 { margin: 0; font-size: clamp(36px, 5vw, 56px); letter-spacing: -2px; }
.summary { margin-top: 32px; }
ul { list-style: none; padding: 0; }
li { padding: 20px 0; border-bottom: 1px solid var(--color-border); }
h3 { margin-top: 0; }
dl { display: grid; grid-template-columns: 1fr auto; gap: 12px; }
dt { color: var(--color-muted); }
dd { margin: 0; }
.back-link { display: inline-block; margin-top: 24px; text-decoration: underline; text-underline-offset: 3px; }
@media (max-width: 480px) {
  dl { grid-template-columns: 1fr; gap: 6px; }
  dd { margin-bottom: 10px; }
}
</style>
