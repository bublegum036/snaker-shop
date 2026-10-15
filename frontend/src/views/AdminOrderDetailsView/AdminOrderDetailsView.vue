<script setup lang="ts">
import { RouterLink } from 'vue-router'
import OrderContents from '@/components/orders/OrderContents/OrderContents.vue'
import AdminOrderStatus from '@/components/admin/AdminOrderStatus/AdminOrderStatus.vue'
import { useAdminOrderDetails } from '@/composables/admin/useAdminOrderDetails/useAdminOrderDetails'
import { adminOrderDetailsViewTexts as text } from './AdminOrderDetailsView.texts'

const props = defineProps<{ orderId: string }>()
const { order, loading, saving, error, busy, isAdmin, nextStatus, canChange, confirming, load, requestChange, cancelChange, confirmChange } = useAdminOrderDetails(() => props.orderId)
</script>

<template>
  <section class="admin-order" aria-labelledby="admin-order-title" :aria-busy="busy">
    <div class="page-heading">
      <h1 id="admin-order-title">{{ text.title }}</h1>
      <button v-if="isAdmin" type="button" class="text-button" :disabled="busy" @click="load">{{ text.refresh }}</button>
    </div>
    <p v-if="!isAdmin" class="error-text" role="alert">{{ text.forbidden }}</p>
    <template v-else>
      <p v-if="loading" class="hint-text" role="status">{{ text.loading }}</p>
      <div v-if="error" class="error-text" role="alert">
        <p>{{ error }}</p><button type="button" class="secondary-button" :disabled="busy" @click="load">{{ text.retry }}</button>
      </div>
      <template v-if="order">
        <p class="hint-text">{{ text.customer(order.user_id) }}</p>
        <OrderContents :order="order" />
        <button v-if="nextStatus" type="button" class="primary-button" :disabled="!canChange" @click="requestChange">{{ text.advance(nextStatus) }}</button>
        <p v-else class="hint-text">{{ text.noTransitions }}</p>
        <AdminOrderStatus v-if="confirming && nextStatus" :order-id="order.id" :status="nextStatus" :saving="saving" :disabled="!canChange" @confirm="confirmChange" @cancel="cancelChange" />
      </template>
    </template>
    <RouterLink class="back-link" :to="{ name: 'admin-orders' }">{{ text.back }}</RouterLink>
  </section>
</template>

<style scoped>
.admin-order {
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

.back-link {
  display: block;
  margin-top: 24px;
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
