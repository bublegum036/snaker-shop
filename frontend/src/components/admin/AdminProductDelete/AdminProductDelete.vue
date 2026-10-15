<script setup lang="ts">
import type { Product } from '@/api/catalog.api'
import ConfirmDialog from '@/components/common/ConfirmDialog/ConfirmDialog.vue'
import { adminProductDeleteTexts as text } from './AdminProductDelete.texts'

defineProps<{ product: Product; disabled: boolean; saving: boolean }>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <ConfirmDialog :title="text.title" :message="text.question(product.name)" :confirm-text="text.confirm" :cancel-text="text.cancel"
    :pending-text="text.deleting" :busy="saving" :confirm-disabled="disabled" destructive @confirm="emit('confirm')" @cancel="emit('cancel')">
    <p class="hint-text">{{ text.hint }}</p>
  </ConfirmDialog>
</template>
