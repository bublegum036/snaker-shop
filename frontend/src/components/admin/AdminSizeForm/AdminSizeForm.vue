<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { ProductSize } from '@/api/catalog.api'
import type { SizeWrite } from '@/api/admin-inventory.api'
import { sizeBody, sizeDraft } from './AdminSizeForm.model'
import { adminSizeFormTexts as text } from './AdminSizeForm.texts'

const props = defineProps<{ size: ProductSize | null; disabled: boolean; saving: boolean }>()
const emit = defineEmits<{ save: [body: SizeWrite]; cancel: [] }>()
const draft = reactive(sizeDraft(props.size))
const error = ref('')
const unchanged = computed(() => !!props.size && Number(draft.size.replace(',', '.')) === Number(props.size.size) && draft.stock === props.size.stock)

function submit() {
  if (props.disabled || unchanged.value) return
  error.value = ''
  try { emit('save', sizeBody(draft)) }
  catch (cause) { error.value = cause instanceof Error ? cause.message : text.invalidSize }
}
</script>

<template>
  <form class="size-editor" aria-labelledby="size-editor-title" @submit.prevent="submit">
    <h2 id="size-editor-title">{{ size ? text.editTitle : text.createTitle }}</h2>
    <fieldset :disabled="disabled">
      <label>{{ text.size }}<input v-model="draft.size" type="text" inputmode="decimal" required></label>
      <label>{{ text.stock }}<input v-model.number="draft.stock" type="number" min="0" max="2147483647" step="1" required aria-describedby="stock-hint"></label>
      <p id="stock-hint" class="hint-text">{{ text.stockHint }}</p>
      <p v-if="error" class="error-text" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button type="submit" class="primary-button" :disabled="unchanged">{{ saving ? text.saving : size ? text.save : text.create }}</button>
        <button type="button" class="secondary-button" @click="emit('cancel')">{{ text.cancel }}</button>
      </div>
    </fieldset>
  </form>
</template>

<style scoped>
.size-editor { margin-block: 24px; padding: 24px; border: 1px solid var(--color-border); }
h2 { margin-top: 0; }
fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
label { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; font-size: 14px; }
.form-actions { display: flex; flex-wrap: wrap; gap: 12px; }
</style>
