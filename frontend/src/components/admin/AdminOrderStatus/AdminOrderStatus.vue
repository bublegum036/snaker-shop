<script setup lang="ts">
import ConfirmDialog from '@/components/common/ConfirmDialog/ConfirmDialog.vue'
import { adminOrderStatusTexts as text } from './AdminOrderStatus.texts'

defineProps<{ orderId: number; status: string; saving: boolean; disabled: boolean }>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <ConfirmDialog :title="text.title" :message="text.question(orderId, status)" :confirm-text="text.confirm"
    :pending-text="text.saving" :busy="saving" :confirm-disabled="disabled" @confirm="emit('confirm')" @cancel="emit('cancel')">
    <p class="hint-text">{{ text.hint }}</p>
  </ConfirmDialog>
</template>
