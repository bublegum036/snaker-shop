<script setup lang="ts">
import type { Order } from '@/api/orders.api'
import { formatPrice } from '@/utils/format-price'
import { orderSummaryTexts as text } from './OrderSummary.texts'

defineProps<{ order: Order }>()
</script>

<template>
  <div class="order-summary">
    <h2>{{ text.number(order.id) }}</h2>
    <dl>
      <dt>{{ text.date }}</dt><dd><time :datetime="order.created_at">{{ text.dateValue(order.created_at) }}</time></dd>
      <dt>{{ text.status }}</dt><dd>{{ text.statusName(order.status) }}</dd>
      <dt>{{ text.total }}</dt><dd>{{ formatPrice(order.total) }}</dd>
      <dt>{{ text.positions }}</dt><dd>{{ order.items.length }}</dd>
    </dl>
  </div>
</template>

<style scoped>
h2 {
  margin: 0 0 20px;
  font-size: 24px;
}

dl {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  margin: 0;
}
dt { color: var(--color-muted); }

dd {
  margin: 0;
  text-align: right;
}

@media (width <= 480px) {
  dl {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  dd {
    text-align: left;
    margin-bottom: 10px;
  }
}
</style>
