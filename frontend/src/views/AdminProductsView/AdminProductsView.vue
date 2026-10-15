<script setup lang="ts">
import AdminProductForm from '@/components/admin/AdminProductForm/AdminProductForm.vue'
import AdminProductRow from '@/components/admin/AdminProductRow/AdminProductRow.vue'
import AdminProductDelete from '@/components/admin/AdminProductDelete/AdminProductDelete.vue'
import { useAdminProducts } from '@/composables/admin/useAdminProducts/useAdminProducts'
import { adminProductsViewTexts as text } from './AdminProductsView.texts'

const { products, brands, loading, saving, busy, error, accessDenied, page, requestedPage, hasNextPage,
  editorOpen, editing, editorVersion, deleting, isAdmin, canWrite, load, openEditor, closeEditor, requestDelete, cancelDelete, save, confirmDelete } = useAdminProducts()
</script>

<template>
  <section class="admin-page" aria-labelledby="admin-products-title" :aria-busy="busy">
    <div class="page-heading">
      <h1 id="admin-products-title">{{ text.title }}</h1>
      <button v-if="isAdmin" type="button" class="text-button" :disabled="busy" @click="load()">{{ text.refresh }}</button>
    </div>
    <p>{{ text.intro }}</p>
    <p v-if="!isAdmin" class="error-text" role="alert">{{ text.forbidden }}</p>
    <template v-else>
      <p v-if="loading" class="hint-text" role="status">{{ text.loading }}</p>
      <div v-if="error" class="error-text" role="alert">
        <p>{{ error }}</p>
        <button type="button" class="secondary-button" :disabled="busy" @click="load(requestedPage)">{{ text.retry }}</button>
      </div>
      <template v-if="!accessDenied">
        <button type="button" class="primary-button" :disabled="!canWrite" @click="openEditor()">{{ text.create }}</button>
        <p v-if="!loading && !error && !brands.length" class="hint-text">{{ text.noBrands }}</p>
        <AdminProductForm v-if="editorOpen" :key="editorVersion" :product="editing" :brands="brands" :disabled="!canWrite" :saving="saving" @save="save" @cancel="closeEditor" />
        <AdminProductDelete v-if="deleting" :product="deleting" :disabled="!canWrite" :saving="saving" @confirm="confirmDelete" @cancel="cancelDelete" />
        <template v-if="!loading">
          <p v-if="!products.length && !error" role="status">{{ text.empty }}</p>
          <ul v-else :aria-label="text.listLabel">
            <li v-for="product in products" :key="product.id">
              <AdminProductRow :product="product" :brands="brands" :disabled="!canWrite" @edit="openEditor(product)" @remove="requestDelete(product)" />
            </li>
          </ul>
          <nav v-if="page > 1 || hasNextPage" class="pagination" :aria-label="text.pagination">
            <button type="button" class="secondary-button" :disabled="busy || page === 1" @click="load(page - 1)">{{ text.previous }}</button>
            <span>{{ text.page(page) }}</span>
            <button type="button" class="secondary-button" :disabled="busy || !hasNextPage" @click="load(page + 1)">{{ text.next }}</button>
          </nav>
        </template>
      </template>
    </template>
  </section>
</template>

<style scoped>
.admin-page {
  max-width: 1000px;
  margin: 64px auto;
}

.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

h1 {
  margin: 0;
  font-size: clamp(32px, 5vw, 52px);
  letter-spacing: -2px;
}

ul {
  list-style: none;
  padding: 0;
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 24px;
}
</style>
