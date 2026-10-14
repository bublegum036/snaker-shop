<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useCartStore } from '@/stores/cart.store'

const cart = useCartStore()
</script>

<template>
  <RouterLink :to="{ name: 'cart' }">
    Корзина<span v-if="cart.data"> ({{ cart.itemCount }})</span><span v-else-if="cart.loading || cart.mutating"> (…)</span>
  </RouterLink>
</template>
