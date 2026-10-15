<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import AdminSizeForm from '@/components/admin/AdminSizeForm/AdminSizeForm.vue'
import AdminSizeRow from '@/components/admin/AdminSizeRow/AdminSizeRow.vue'
import AdminSizeDelete from '@/components/admin/AdminSizeDelete/AdminSizeDelete.vue'
import { useAdminInventory } from '@/composables/admin/useAdminInventory/useAdminInventory'
import { adminInventoryViewTexts as text } from './AdminInventoryView.texts'

const props = defineProps<{ productId: string }>()
const { product, loading, saving, error, accessDenied, editorOpen, editing, editorVersion, deleting, isAdmin, busy, canWrite,
  load, openEditor, closeEditor, requestDelete, cancelDelete, save, confirmDelete } = useAdminInventory(() => props.productId)
const sizes = computed(() => [...(product.value?.sizes ?? [])].sort((first, second) => Number(first.size) - Number(second.size)))
</script>

<template>
  <section class="inventory-page" aria-labelledby="inventory-title" :aria-busy="busy">
    <div class="page-heading">
      <h1 id="inventory-title">{{ text.title }}</h1>
      <button v-if="isAdmin" type="button" class="text-button" :disabled="busy" @click="load">{{ text.refresh }}</button>
    </div>
    <p v-if="!isAdmin" class="error-text" role="alert">{{ text.forbidden }}</p>
    <template v-else>
      <p v-if="loading" class="hint-text" role="status">{{ text.loading }}</p>
      <div v-if="error" class="error-text" role="alert">
        <p>{{ error }}</p>
        <button type="button" class="secondary-button" :disabled="busy" @click="load">{{ text.retry }}</button>
      </div>
      <template v-if="product && !accessDenied">
        <h2 class="product-name">{{ product.name }}</h2>
        <button type="button" class="primary-button" :disabled="!canWrite" @click="openEditor()">{{ text.create }}</button>
        <AdminSizeForm v-if="editorOpen" :key="editorVersion" :size="editing" :disabled="!canWrite" :saving="saving" @save="save" @cancel="closeEditor" />
        <AdminSizeDelete v-if="deleting" :size="deleting" :product-name="product.name" :disabled="!canWrite" :saving="saving" @confirm="confirmDelete" @cancel="cancelDelete" />
        <p v-if="!sizes.length" role="status">{{ text.empty }}</p>
        <ul v-else :aria-label="text.listLabel">
          <li v-for="size in sizes" :key="size.id"><AdminSizeRow :size="size" :disabled="!canWrite" @edit="openEditor(size)" @remove="requestDelete(size)" /></li>
        </ul>
      </template>
    </template>
    <RouterLink class="back-link" :to="{ name: 'admin-products' }">{{ text.back }}</RouterLink>
  </section>
</template>

<style scoped>
.inventory-page { max-width: 1000px; margin: 64px auto; }
.page-heading { display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap; }
h1 { margin: 0; font-size: clamp(32px, 5vw, 52px); letter-spacing: -2px; }
.product-name { margin-top: 32px; overflow-wrap: anywhere; }
ul { list-style: none; padding: 0; }
.back-link { display: inline-block; margin-top: 24px; text-decoration: underline; text-underline-offset: 3px; }
</style>
