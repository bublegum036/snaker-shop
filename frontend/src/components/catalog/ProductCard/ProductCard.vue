<script setup lang="ts">
import { productCardTexts as text } from './ProductCard.texts'
import { computed, ref, watch } from 'vue'
import type { Product } from '@/api/catalog.api'
import ProductCartForm from '@/components/cart/ProductCartForm/ProductCartForm.vue'
import { formatPrice } from '@/utils/format-price'

const props = defineProps<{ product: Product; index: number }>()
const imageFailed = ref(false)
const availableSizes = computed(() => props.product.sizes.filter((size) => size.stock > 0))
const price = computed(() => formatPrice(props.product.price))

watch(() => props.product.image_url, () => { imageFailed.value = false })
</script>

<template>
  <article class="product-card">
    <div class="product-visual" :class="`tone-${index % 3}`">
      <span class="product-number">{{ String(index + 1).padStart(2, '0') }} / {{ text.brand }}</span>
      <img v-if="product.image_url && !imageFailed" :src="product.image_url" :alt="product.name" loading="lazy" @error="imageFailed = true">
      <div v-else class="product-placeholder"><span aria-hidden="true">{{ text.monogram }}<span class="placeholder-dot">{{ text.monogramDot }}</span></span><small>{{ text.photoPending }}</small></div>
      <span class="stock-badge">{{ availableSizes.length ? text.inStock : text.unavailable }}</span>
    </div>
    <div class="product-heading"><h3>{{ product.name }}</h3><span class="product-price">{{ price }}</span></div>
    <p v-if="product.description" class="product-description">{{ product.description }}</p>
    <ProductCartForm :product="product" />
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

@media (max-width: 600px) {
  .product-visual {
    aspect-ratio: 1.2;
  }
}
</style>
