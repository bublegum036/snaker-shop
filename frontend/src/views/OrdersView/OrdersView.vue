<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useOrderHistory } from '@/composables/orders/useOrderHistory/useOrderHistory'
import OrderSummary from '@/components/orders/OrderSummary/OrderSummary.vue'
import { ordersViewTexts as text } from './OrdersView.texts'

const { orders, loading, error, page, requestedPage, hasNextPage, load } = useOrderHistory()
</script>

<template>
  <section class="orders-page" aria-labelledby="orders-title">
    <div class="page-heading">
      <h1 id="orders-title">{{ text.title }}</h1>
      <button type="button" class="text-button" :disabled="loading" @click="load()">{{ text.refresh }}</button>
    </div>
    <p v-if="loading" class="hint-text" role="status">{{ text.loading }}</p>
    <div v-else-if="error" class="error-text" role="alert">
      <p>{{ error }}</p>
      <button type="button" class="secondary-button" @click="load(requestedPage)">{{ text.retry }}</button>
    </div>
    <template v-else>
      <p v-if="!orders.length" role="status">{{ page === 1 ? text.empty : text.emptyPage }}</p>
      <ul v-else :aria-label="text.listLabel">
        <li v-for="order in orders" :key="order.id">
          <OrderSummary :order="order" />
          <RouterLink class="details-link" :to="{ name: 'order-details', params: { orderId: order.id } }">{{ text.open }}</RouterLink>
        </li>
      </ul>
      <nav v-if="page > 1 || hasNextPage" class="pagination" :aria-label="text.pagination">
        <button type="button" class="secondary-button" :disabled="page === 1" @click="load(page - 1)">{{ text.previous }}</button>
        <span>{{ text.page(page) }}</span>
        <button type="button" class="secondary-button" :disabled="!hasNextPage" @click="load(page + 1)">{{ text.next }}</button>
      </nav>
    </template>
    <RouterLink class="catalog-link" :to="{ name: 'catalog' }">{{ text.catalog }}</RouterLink>
  </section>
</template>

<style scoped>
.orders-page {
  max-width: 900px;
  margin: 64px auto;
}

.page-heading {
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

li {
  padding: 24px 0;
  border-bottom: 1px solid var(--color-border);
}

.details-link, .catalog-link {
  display: inline-block;
  margin-top: 24px;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 24px;
  flex-wrap: wrap;
}
</style>
