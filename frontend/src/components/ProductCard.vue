<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Product } from '@/api/catalog.api'

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

<style scoped>
.product-visual {
  aspect-ratio: 1.12;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e8ebe3;
  overflow: hidden;
}

.tone-1 {
  background: #eeebe3;
}

.tone-2 {
  background: #e4e9e8;
}

.product-number {
  position: absolute;
  left: 18px;
  top: 18px;
  font-size: 10px;
  letter-spacing: 1.3px;
  z-index: 1;
}

.product-placeholder {
  display: flex;
  align-items: center;
  flex-direction: column;
}

.product-placeholder > span {
  font-size: 114px;
  font-style: italic;
  font-weight: 850;
  letter-spacing: -12px;
  color: #bdc6b4;
  line-height: 1.1;
}

.placeholder-dot {
  color: #8e9d7b;
}

.product-placeholder small {
  font-size: 11px;
  color: var(--color-muted);
  margin-top: 12px;
}

.product-visual img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.stock-badge {
  position: absolute;
  bottom: 15px;
  left: 16px;
  padding: 7px 9px;
  background: rgb(247 247 242 / 91%);
  font-size: 10px;
}

.product-heading {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin-top: 18px;
}

h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}

.product-price {
  white-space: nowrap;
  font-size: 15px;
}

.product-description {
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-muted);
  margin-bottom: 0;
}

.product-sizes {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 12px;
  margin-top: 17px;
  color: var(--color-muted);
}

.product-sizes ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.product-sizes li {
  padding: 5px 7px;
  border: 1px solid #d2d9cc;
  color: var(--color-text);
}

@media (max-width: 600px) {
  .product-visual {
    aspect-ratio: 1.2;
  }
}
</style>
