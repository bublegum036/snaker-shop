<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useOrderDetails } from '@/composables/orders/useOrderDetails/useOrderDetails'
import OrderContents from '@/components/orders/OrderContents/OrderContents.vue'
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
    <OrderContents v-else-if="order" :order="order" />
    <RouterLink class="back-link" :to="{ name: 'orders' }">{{ text.back }}</RouterLink>
  </section>
</template>

<style scoped>
.order-page { max-width: 900px; margin: 64px auto; }
.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
h1 { margin: 0; font-size: clamp(36px, 5vw, 56px); letter-spacing: -2px; }
.back-link { display: inline-block; margin-top: 24px; text-decoration: underline; text-underline-offset: 3px; }
</style>
