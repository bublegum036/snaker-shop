<script setup lang="ts">
import type { OrderItem } from '@/api/orders.api'
import { formatPrice } from '@/utils/format-price'
import { orderItemLineTexts as text } from './OrderItemLine.texts'

defineProps<{ item: OrderItem; index: number }>()
</script>

<template>
  <div class="order-item-line">
    <h3>{{ item.name_at_purchase ?? text.position(index) }}</h3>
    <dl>
      <template v-if="item.size_at_purchase != null">
        <dt>{{ text.size }}</dt><dd>{{ item.size_at_purchase }}</dd>
      </template>
      <template v-else>
        <dt>{{ text.sizeCode }}</dt><dd>{{ item.product_size_id }}</dd>
      </template>
      <dt>{{ text.quantity }}</dt><dd>{{ item.quantity }}</dd>
      <dt>{{ text.price }}</dt><dd>{{ formatPrice(item.price_at_purchase) }}</dd>
    </dl>
  </div>
</template>

<style scoped>
h3 {
  margin-top: 0;
  overflow-wrap: anywhere;
}

dl {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
}
dt { color: var(--color-muted); }
dd { margin: 0; }

@media (width <= 480px) {
  dl {
    grid-template-columns: 1fr;
    gap: 6px;
  }
  dd { margin-bottom: 10px; }
}
</style>
