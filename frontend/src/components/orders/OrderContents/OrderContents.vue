<script setup lang="ts">
import { computed } from 'vue'
import type { Order } from '@/api/orders.api'
import OrderSummary from '@/components/orders/OrderSummary/OrderSummary.vue'
import OrderItemLine from '@/components/orders/OrderItemLine/OrderItemLine.vue'
import { orderContentsTexts as text } from './OrderContents.texts'

const props = defineProps<{ order: Order }>()
const hasLegacyItems = computed(() => props.order.items.some((item) => item.name_at_purchase == null || item.size_at_purchase == null))
</script>

<template>
  <div class="order-contents">
    <OrderSummary :order="order" />
    <h2>{{ text.items }}</h2>
    <p v-if="hasLegacyItems" class="hint-text">{{ text.legacyItems }}</p>
    <ul><li v-for="(item, index) in order.items" :key="item.id"><OrderItemLine :item="item" :index="index" /></li></ul>
  </div>
</template>

<style scoped>
.order-contents { margin-top: 32px; }

ul {
  list-style: none;
  padding: 0;
}

li {
  padding: 20px 0;
  border-bottom: 1px solid var(--color-border);
}
</style>
