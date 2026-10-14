<script setup lang="ts">
import { catalogViewTexts as text } from './CatalogView.texts'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getBrands, getProducts, type Brand, type Product, type ProductFilters } from '@/api/catalog.api'
import ProductCard from '@/components/catalog/ProductCard/ProductCard.vue'
import CatalogFilters from '@/components/catalog/CatalogFilters/CatalogFilters.vue'

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
        ? text.networkError
        : cause instanceof Error ? cause.message : text.loadError
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
    if (!request.signal.aborted) brandsError.value = text.brandsError
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
      <div><p class="eyebrow">{{ text.collection }}</p><h1 id="catalog-title">{{ text.titleFirstLine }}<br><span>{{ text.titleSecondLine }}</span></h1></div>
      <p class="intro-description">{{ text.introFirstLine }}<br>{{ text.introSecondLine }}</p>
    </div>
    <CatalogFilters
      :brands="brands" :busy="loading" :brands-loading="brandsLoading" :brands-error="brandsError"
      @apply="applyFilters" @retry-brands="loadBrands"
    />
    <div class="catalog-toolbar">
      <h2>{{ text.catalog }} <span v-if="!loading && !error">{{ text.count(products.length) }}</span></h2>
      <button type="button" class="text-button" :disabled="loading" @click="loadProducts()">{{ text.refresh }}</button>
    </div>
    <p v-if="loading" class="catalog-message" role="status">{{ text.loading }}</p>
    <div v-else-if="error" class="catalog-message error-message" role="alert">
      <p>{{ error }}</p><button type="button" @click="loadProducts(requestedPage)">{{ text.retry }}</button>
    </div>
    <p v-else-if="products.length === 0" class="catalog-message" role="status">{{ text.empty }}</p>
    <ul v-else class="product-grid" :aria-label="text.productsLabel">
      <li v-for="(product, index) in products" :key="product.id">
        <ProductCard :product="product" :index="firstItemIndex + index" />
      </li>
    </ul>
    <nav class="catalog-pagination" :aria-label="text.paginationLabel">
      <label>{{ text.pageSize }}
        <select v-model="pageSize" :disabled="loading" @change="loadProducts(1)">
          <option :value="3">3</option><option :value="12">12</option><option :value="24">24</option>
        </select>
      </label>
      <span v-if="!loading && !error" role="status">{{ text.page(page) }}</span>
      <div>
        <button type="button" class="secondary-button" :disabled="loading || !!error || page === 1" @click="loadProducts(page - 1)">{{ text.previous }}</button>
        <button type="button" class="secondary-button" :disabled="loading || !!error || !hasNextPage" @click="loadProducts(page + 1)">{{ text.next }}</button>
      </div>
    </nav>
  </section>
</template>

<style scoped>
.catalog-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: 36px;
}

.catalog-pagination label, .catalog-pagination > div {
  display: flex;
  align-items: center;
  gap: 12px;
}

nav {
  font-size: 14px;
  font-weight: 600;
}

.catalog-intro {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 62px 0 52px;
}

h1 {
  margin: 0;
  font-size: clamp(56px, 6.6vw, 88px);
  font-weight: 650;
  line-height: .98;
  letter-spacing: -5px;
}

h1 span {
  color: #74865a;
}

.intro-description {
  margin: 0 0 5px;
  color: var(--color-muted);
  font-size: 16px;
  line-height: 1.6;
}

.catalog-toolbar {
  border-block: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 68px;
  margin-bottom: 28px;
  gap: 16px;
}

h2 {
  font-size: 16px;
  font-weight: 600;
}

h2 span {
  color: #778171;
  margin-left: 10px;
  font-size: 13px;
  font-weight: 400;
}

.product-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 38px 24px;
}

.catalog-message {
  padding: 70px 20px;
  text-align: center;
  background: #eeefe8;
  line-height: 1.6;
}

.error-message button {
  border: 1px solid var(--color-text);
  padding: 10px 18px;
  background: transparent;
}

@media (max-width: 1000px) {
  .product-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .catalog-intro {
    padding: 42px 0 32px;
  }

  h1 {
    font-size: 58px;
    letter-spacing: -3px;
  }

  .intro-description {
    display: none;
  }

  .product-grid {
    grid-template-columns: 1fr;
    gap: 32px;
  }
}
</style>
