<script setup lang="ts">
import { RouterLink } from 'vue-router'
import OrderSummary from '@/components/orders/OrderSummary/OrderSummary.vue'
import { useAdminOrders } from '@/composables/admin/useAdminOrders/useAdminOrders'
import { adminOrdersViewTexts as text } from './AdminOrdersView.texts'

const { orders, status, page, requestedPage, hasNextPage, loading, error, isAdmin, load } = useAdminOrders()
</script>

<template>
  <section class="admin-orders" aria-labelledby="admin-orders-title">
    <div class="page-heading">
      <h1 id="admin-orders-title">{{ text.title }}</h1>
      <button v-if="isAdmin" type="button" class="text-button" :disabled="loading" @click="load()">{{ text.refresh }}</button>
    </div>
    <p v-if="!isAdmin" class="error-text" role="alert">{{ text.forbidden }}</p>
    <template v-else>
      <label class="status-filter">{{ text.status }}
        <select v-model="status"><option v-for="option in text.statusOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select>
      </label>
      <p v-if="loading" class="hint-text" role="status">{{ text.loading }}</p>
      <div v-else-if="error" class="error-text" role="alert">
        <p>{{ error }}</p><button type="button" class="secondary-button" @click="load(requestedPage)">{{ text.retry }}</button>
      </div>
      <template v-else>
        <p v-if="!orders.length" role="status">{{ text.empty }}</p>
        <ul v-else :aria-label="text.listLabel"><li v-for="order in orders" :key="order.id">
          <p class="hint-text">{{ text.customer(order.user_id) }}</p>
          <OrderSummary :order="order" />
          <RouterLink class="details-link" :to="{ name: 'admin-order-details', params: { orderId: order.id } }">{{ text.open }}</RouterLink>
        </li></ul>
        <nav v-if="page > 1 || hasNextPage" class="pagination" :aria-label="text.pagination">
          <button type="button" class="secondary-button" :disabled="page === 1" @click="load(page - 1)">{{ text.previous }}</button>
          <span>{{ text.page(page) }}</span>
          <button type="button" class="secondary-button" :disabled="!hasNextPage" @click="load(page + 1)">{{ text.next }}</button>
        </nav>
      </template>
    </template>
  </section>
</template>

<style scoped>
.admin-orders {
  max-width: 1000px;
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
  font-size: clamp(32px, 5vw, 52px);
  letter-spacing: -2px;
}

.status-filter {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-block: 24px;
}

ul {
  list-style: none;
  padding: 0;
}

li {
  padding-block: 24px;
  border-bottom: 1px solid var(--color-border);
}

.details-link {
  display: inline-block;
  margin-top: 24px;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}
</style>
