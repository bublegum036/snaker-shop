<script setup lang="ts">
import type { ProductSize } from '@/api/catalog.api'
import { adminSizeRowTexts as text } from './AdminSizeRow.texts'

defineProps<{ size: ProductSize; disabled: boolean }>()
const emit = defineEmits<{ edit: []; remove: [] }>()
</script>

<template>
  <article class="size-row">
    <div>
      <h2>{{ text.size(size.size) }}</h2>
      <p>{{ text.stock(size.stock) }}</p>
      <p v-if="size.stock === 0" class="hint-text">{{ text.unavailable }}</p>
    </div>
    <div class="row-actions">
      <button type="button" class="secondary-button" :disabled="disabled" :aria-label="text.editLabel(size.size)" @click="emit('edit')">{{ text.edit }}</button>
      <button type="button" class="text-button remove-button" :disabled="disabled" :aria-label="text.removeLabel(size.size)" @click="emit('remove')">{{ text.remove }}</button>
    </div>
  </article>
</template>

<style scoped>
.size-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  padding-block: 20px;
  border-bottom: 1px solid var(--color-border);
}

h2 {
  margin: 0;
  font-size: 22px;
}
p { margin-bottom: 0; }

.row-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.remove-button { color: var(--color-error); }
</style>
