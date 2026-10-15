<script setup lang="ts">
import type { ProductSize } from '@/api/catalog.api'
import ConfirmDialog from '@/components/common/ConfirmDialog/ConfirmDialog.vue'
import { adminSizeDeleteTexts as text } from './AdminSizeDelete.texts'

defineProps<{ size: ProductSize; productName: string; disabled: boolean; saving: boolean }>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <ConfirmDialog :title="text.title" :message="text.question(size.size, productName)" :confirm-text="text.confirm" :cancel-text="text.cancel"
    :pending-text="text.deleting" :busy="saving" :confirm-disabled="disabled" destructive @confirm="emit('confirm')" @cancel="emit('cancel')">
    <p class="hint-text">{{ text.hint }}</p>
  </ConfirmDialog>
</template>
