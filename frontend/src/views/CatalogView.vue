<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getBrands, getProducts, type Brand, type Product, type ProductFilters } from '@/api/catalog'
import ProductCard from '@/components/ProductCard.vue'
import CatalogFilters from '@/components/CatalogFilters.vue'

const products = ref<Product[]>([])
const loading = ref(true)
const error = ref('')
const brands = ref<Brand[]>([])
const brandsLoading = ref(true)
const brandsError = ref('')
// Черновик формы живёт в CatalogFilters; здесь только применённые параметры.
const appliedFilters = ref<ProductFilters>({})
const pageSize = ref(12)
const page = ref(1)
const requestedPage = ref(1)
const hasNextPage = ref(false)
const firstItemIndex = computed(() => (page.value - 1) * pageSize.value)
let productRequest: AbortController | undefined
let brandRequest: AbortController | undefined

async function loadProducts(targetPage = page.value) {
  productRequest?.abort()
  const request = new AbortController()
  productRequest = request
  requestedPage.value = targetPage
  loading.value = true
  error.value = ''
  try {
    const result = await getProducts({
      ...appliedFilters.value,
      limit: pageSize.value + 1,
      offset: (targetPage - 1) * pageSize.value,
    }, request.signal)
    if (request.signal.aborted) return
    hasNextPage.value = result.length > pageSize.value
    products.value = result.slice(0, pageSize.value)
    page.value = targetPage
  } catch (cause) {
    if (!request.signal.aborted) {
      error.value = cause instanceof TypeError
        ? 'Нет связи с каталогом. Попробуйте ещё раз.'
        : cause instanceof Error ? cause.message : 'Не удалось загрузить каталог.'
    }
  } finally {
    if (productRequest === request) loading.value = false
  }
}

async function loadBrands() {
  brandRequest?.abort()
  const request = new AbortController()
  brandRequest = request
  brandsLoading.value = true
  brandsError.value = ''
  try {
    const result = await getBrands(request.signal)
    if (!request.signal.aborted) brands.value = result
  } catch {
    if (!request.signal.aborted) brandsError.value = 'Не удалось загрузить бренды.'
  } finally {
    if (brandRequest === request) brandsLoading.value = false
  }
}

function applyFilters(filters: ProductFilters) {
  appliedFilters.value = filters
  void loadProducts(1)
}

onMounted(() => {
  void loadProducts()
  void loadBrands()
})
onBeforeUnmount(() => {
  productRequest?.abort()
  brandRequest?.abort()
})
</script>

<template>
  <section class="catalog" aria-labelledby="catalog-title">
    <div class="catalog-intro">
      <div><p class="eyebrow">Коллекция / 01</p><h1 id="catalog-title">Твой следующий<br><span>шаг.</span></h1></div>
      <p class="intro-description">Для городских маршрутов<br>и новых направлений.</p>
    </div>
    <CatalogFilters
      :brands="brands" :busy="loading" :brands-loading="brandsLoading" :brands-error="brandsError"
      @apply="applyFilters" @retry-brands="loadBrands"
    />
    <div class="catalog-toolbar">
      <h2>Каталог <span v-if="!loading && !error">/ на странице: {{ products.length }}</span></h2>
      <button type="button" class="text-button" :disabled="loading" @click="loadProducts()">Обновить каталог ↗</button>
    </div>
    <p v-if="loading" class="catalog-message" role="status">Загружаем коллекцию…</p>
    <div v-else-if="error" class="catalog-message error-message" role="alert">
      <p>{{ error }}</p><button type="button" @click="loadProducts(requestedPage)">Повторить запрос</button>
    </div>
    <p v-else-if="products.length === 0" class="catalog-message" role="status">Товары не найдены. Измените фильтры или сбросьте их.</p>
    <ul v-else class="product-grid" aria-label="Товары">
      <li v-for="(product, index) in products" :key="product.id">
        <ProductCard :product="product" :index="firstItemIndex + index" />
      </li>
    </ul>
    <nav class="catalog-pagination" aria-label="Страницы каталога">
      <label>На странице
        <select v-model="pageSize" :disabled="loading" @change="loadProducts(1)">
          <option :value="3">3</option><option :value="12">12</option><option :value="24">24</option>
        </select>
      </label>
      <span v-if="!loading && !error" role="status">Страница {{ page }}</span>
      <div>
        <button type="button" class="secondary-button" :disabled="loading || !!error || page === 1" @click="loadProducts(page - 1)">Назад</button>
        <button type="button" class="secondary-button" :disabled="loading || !!error || !hasNextPage" @click="loadProducts(page + 1)">Далее</button>
      </div>
    </nav>
  </section>
</template>
