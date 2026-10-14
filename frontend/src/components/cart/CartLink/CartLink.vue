<script setup lang="ts">
import { cartLinkTexts as text } from './CartLink.texts'
import { RouterLink } from 'vue-router'
import { useCartStore } from '@/stores/cart/cart.store'

const cart = useCartStore()
</script>

<template>
  <RouterLink :to="{ name: 'cart' }">
    {{ text.label(cart.data ? cart.itemCount : null, cart.loading || cart.mutating) }}
  </RouterLink>
</template>
