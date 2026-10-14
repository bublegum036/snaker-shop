<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getProducts, type Product } from '@/api/catalog'
import ProductCard from '@/components/ProductCard.vue'

const products = ref<Product[]>([])
const loading = ref(true)
const error = ref('')

async function loadProducts() {
  loading.value = true
  error.value = ''
  try {
    products.value = await getProducts()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Не удалось загрузить каталог.'
  } finally {
    loading.value = false
  }
}

onMounted(loadProducts)
</script>

<template>
  <section class="catalog" aria-labelledby="catalog-title">
    <div class="catalog-intro">
      <div><p class="eyebrow">Коллекция / 01</p><h1 id="catalog-title">Твой следующий<br><span>шаг.</span></h1></div>
      <p class="intro-description">Для городских маршрутов<br>и новых направлений.</p>
    </div>
    <div class="catalog-toolbar">
      <h2>Каталог <span v-if="!loading && !error">/ {{ products.length }}</span></h2>
      <button type="button" class="text-button" :disabled="loading" @click="loadProducts">Обновить каталог ↗</button>
    </div>
    <p v-if="loading" class="catalog-message" role="status">Загружаем коллекцию…</p>
    <div v-else-if="error" class="catalog-message error-message" role="alert">
      <p>{{ error }}</p><button type="button" @click="loadProducts">Повторить запрос</button>
    </div>
    <p v-else-if="products.length === 0" class="catalog-message" role="status">В каталоге пока нет товаров.</p>
    <ul v-else class="product-grid" aria-label="Товары">
      <li v-for="(product, index) in products" :key="product.id">
        <ProductCard :product="product" :index="index" />
      </li>
    </ul>
    <p v-if="!loading && !error && products.length === 20" class="page-note">Показаны первые 20 товаров.</p>
  </section>
</template>
