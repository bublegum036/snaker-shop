<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Product } from '@/api/catalog'

const props = defineProps<{ product: Product; index: number }>()
const imageFailed = ref(false)
const availableSizes = computed(() => props.product.sizes.filter((size) => size.stock > 0))
const price = computed(() => new Intl.NumberFormat('ru-RU', {
  style: 'currency', currency: 'RUB', minimumFractionDigits: 0, maximumFractionDigits: 2,
}).format(Number(props.product.price)))

watch(() => props.product.image_url, () => { imageFailed.value = false })
</script>

<template>
  <article class="product-card">
    <div class="product-visual" :class="`tone-${index % 3}`">
      <span class="product-number">{{ String(index + 1).padStart(2, '0') }} / NORTH</span>
      <img v-if="product.image_url && !imageFailed" :src="product.image_url" :alt="product.name" loading="lazy" @error="imageFailed = true">
      <div v-else class="product-placeholder"><span aria-hidden="true">N<span class="placeholder-dot">.</span></span><small>Фото скоро появится</small></div>
      <span class="stock-badge">{{ availableSizes.length ? 'В наличии' : 'Нет в наличии' }}</span>
    </div>
    <div class="product-heading"><h3>{{ product.name }}</h3><span class="product-price">{{ price }}</span></div>
    <p v-if="product.description" class="product-description">{{ product.description }}</p>
    <div class="product-sizes"><span>Размеры</span><ul v-if="availableSizes.length" aria-label="Доступные размеры"><li v-for="size in availableSizes" :key="size.id">{{ Number(size.size) }}</li></ul><span v-else>—</span></div>
  </article>
</template>
