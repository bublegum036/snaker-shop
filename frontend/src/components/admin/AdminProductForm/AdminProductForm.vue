<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { Brand, Product } from '@/api/catalog.api'
import type { ProductWrite } from '@/api/admin-products.api'
import { productBody, productDraft } from './AdminProductForm.model'
import { adminProductFormTexts as text } from './AdminProductForm.texts'

const props = defineProps<{ product: Product | null; brands: Brand[]; disabled: boolean; saving: boolean }>()
const emit = defineEmits<{ save: [body: ProductWrite]; cancel: [] }>()
const draft = reactive(productDraft(props.product))
const error = ref('')

function submit() {
  if (props.disabled) return
  error.value = ''
  try { emit('save', productBody(draft, props.brands)) }
  catch (cause) { error.value = cause instanceof Error ? cause.message : text.priceInvalid }
}
</script>

<template>
  <form class="product-editor" aria-labelledby="product-editor-title" @submit.prevent="submit">
    <h2 id="product-editor-title">{{ product ? text.editTitle : text.createTitle }}</h2>
    <fieldset :disabled="disabled">
      <label>{{ text.name }}<input v-model="draft.name" type="text" required maxlength="120"></label>
      <label>{{ text.brand }}
        <select v-model="draft.brandId" required>
          <option value="" disabled>{{ text.chooseBrand }}</option>
          <option v-for="brand in brands" :key="brand.id" :value="String(brand.id)">{{ brand.name }}</option>
        </select>
      </label>
      <label>{{ text.price }}<input v-model="draft.price" type="text" inputmode="decimal" required></label>
      <label>{{ text.description }}<textarea v-model="draft.description" rows="4" maxlength="2000"></textarea></label>
      <label>{{ text.image }}<input v-model="draft.imageUrl" type="url" aria-describedby="product-image-hint"></label>
      <p id="product-image-hint" class="hint-text">{{ text.imageHint }}</p>
      <p v-if="error" class="error-text" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button type="submit" class="primary-button">{{ saving ? text.saving : product ? text.save : text.create }}</button>
        <button type="button" class="secondary-button" @click="emit('cancel')">{{ text.cancel }}</button>
      </div>
    </fieldset>
  </form>
</template>

<style scoped>
.product-editor { margin-block: 24px; padding: 24px; border: 1px solid var(--color-border); }
h2 { margin-top: 0; }
fieldset { padding: 0; margin: 0; border: 0; min-width: 0; }
label { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; font-size: 14px; }
textarea { width: 100%; padding: 12px; border: 1px solid var(--color-border); background: var(--color-background); color: inherit; font: inherit; resize: vertical; }
textarea:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 3px; }
.form-actions { display: flex; gap: 12px; flex-wrap: wrap; }
@media (max-width: 480px) { .product-editor { padding: 16px; } }
</style>
