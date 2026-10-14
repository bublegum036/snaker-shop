<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { Brand, ProductFilters } from '@/api/catalog.api'

defineProps<{
  brands: Brand[]
  busy: boolean
  brandsLoading: boolean
  brandsError: string
}>()
const emit = defineEmits<{
  apply: [filters: ProductFilters]
  retryBrands: []
}>()

type OptionalNumber = number | ''
const emptyForm = () => ({
  search: '', brandId: '' as OptionalNumber, size: '' as OptionalNumber,
  minPrice: '' as OptionalNumber, maxPrice: '' as OptionalNumber,
})
const form = reactive(emptyForm())
const validationError = ref('')

function apply() {
  validationError.value = ''
  if (form.minPrice !== '' && form.maxPrice !== '' && form.minPrice > form.maxPrice) {
    validationError.value = 'Цена «от» не должна превышать цену «до».'
    return
  }
  emit('apply', {
    search: form.search.trim() || undefined,
    brand_id: form.brandId === '' ? undefined : form.brandId,
    size: form.size === '' ? undefined : form.size,
    min_price: form.minPrice === '' ? undefined : form.minPrice,
    max_price: form.maxPrice === '' ? undefined : form.maxPrice,
  })
}

function reset() {
  Object.assign(form, emptyForm())
  validationError.value = ''
  emit('apply', {})
}
</script>

<template>
  <form class="catalog-filters" aria-label="Фильтры каталога" @submit.prevent="apply">
    <fieldset :disabled="busy">
      <legend class="visually-hidden">Поиск и фильтры</legend>
      <div class="filter-fields">
        <label class="search-field">Название
          <input v-model.trim="form.search" type="search" maxlength="100" placeholder="Например, North">
        </label>
        <label>Бренд
          <select v-model="form.brandId" :disabled="brandsLoading || !!brandsError">
            <option value="">Все бренды</option>
            <option v-for="brand in brands" :key="brand.id" :value="brand.id">{{ brand.name }}</option>
          </select>
        </label>
        <label>Размер в наличии
          <input v-model="form.size" type="number" min="0.1" max="999" step="0.1" placeholder="Любой">
        </label>
        <label>Цена от, ₽
          <input v-model="form.minPrice" type="number" min="0" step="0.01" placeholder="0">
        </label>
        <label>Цена до, ₽
          <input v-model="form.maxPrice" type="number" min="0" step="0.01" placeholder="Без ограничений">
        </label>
      </div>
      <p v-if="validationError" class="error-text" role="alert">{{ validationError }}</p>
      <div class="filter-actions">
        <button type="submit" class="primary-button">Применить</button>
        <button type="button" class="secondary-button" @click="reset">Сбросить</button>
        <span class="hint-text">Изменения применяются по кнопке или Enter.</span>
      </div>
    </fieldset>
    <p v-if="brandsLoading" class="hint-text" role="status">Загружаем бренды…</p>
    <div v-else-if="brandsError" class="brands-error error-text" role="alert">
      <span>{{ brandsError }} Остальные фильтры доступны.</span>
      <button type="button" class="text-button" @click="emit('retryBrands')">Повторить загрузку брендов</button>
    </div>
  </form>
</template>

<style scoped>
.catalog-filters {
  margin-bottom: 28px;
}

.catalog-filters fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}

.filter-fields {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr 1fr 1fr;
  gap: 14px;
}

.filter-fields label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
}

.filter-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 18px;
}

.brands-error {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

@media (max-width: 1000px) {
  .filter-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .search-field {
    grid-column: 1 / -1;
  }
}
</style>
