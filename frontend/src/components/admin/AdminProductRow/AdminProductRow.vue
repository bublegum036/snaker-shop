<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { computed } from 'vue'
import type { Brand, Product } from '@/api/catalog.api'
import { formatPrice } from '@/utils/format-price'
import { adminProductRowTexts as text } from './AdminProductRow.texts'

const props = defineProps<{ product: Product; brands: Brand[]; disabled: boolean }>()
const emit = defineEmits<{ edit: []; remove: [] }>()
const brandName = computed(() => props.brands.find((brand) => brand.id === props.product.brand_id)?.name ?? text.brandUnknown)
</script>

<template>
  <article class="product-row">
    <div>
      <h2>{{ product.name }}</h2>
      <p>{{ brandName }} · {{ formatPrice(product.price) }}</p>
      <p class="hint-text">{{ text.sizes(product.sizes.length) }}</p>
    </div>
    <div class="row-actions">
      <RouterLink v-if="!disabled" class="inventory-link" :to="{ name: 'admin-inventory', params: { productId: product.id } }">{{ text.inventory }}</RouterLink>
      <span v-else class="hint-text" aria-disabled="true">{{ text.inventory }}</span>
      <button type="button" class="secondary-button" :disabled="disabled" :aria-label="text.editLabel(product.name)" @click="emit('edit')">{{ text.edit }}</button>
      <button type="button" class="text-button remove-button" :disabled="disabled" :aria-label="text.removeLabel(product.name)" @click="emit('remove')">{{ text.remove }}</button>
    </div>
  </article>
</template>

<style scoped>
.product-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-block: 24px;
  border-bottom: 1px solid var(--color-border);
  flex-wrap: wrap;
}

h2 {
  margin: 0;
  font-size: 22px;
  overflow-wrap: anywhere;
}
p { margin-bottom: 0; }

.row-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.inventory-link {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.remove-button { color: var(--color-error); }
</style>
