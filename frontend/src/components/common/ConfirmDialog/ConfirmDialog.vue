<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { confirmDialogTexts as text } from './ConfirmDialog.texts'

const props = withDefaults(defineProps<{
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  pendingText?: string
  busy?: boolean
  confirmDisabled?: boolean
  destructive?: boolean
}>(), { busy: false, confirmDisabled: false, destructive: false })
const emit = defineEmits<{ confirm: []; cancel: [] }>()
const dialog = ref<HTMLDialogElement>()
const titleId = useId()
const messageId = useId()
let previousOverflow = ''

function cancel() { if (!props.busy) { emit('cancel') } }
function confirm() { if (!props.busy && !props.confirmDisabled) { emit('confirm') } }
function backdropClick(event: MouseEvent) {
  if (event.target !== dialog.value) { return }
  const bounds = dialog.value.getBoundingClientRect()
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) { cancel() }
}

onMounted(() => {
  previousOverflow = document.documentElement.style.overflow
  document.documentElement.style.overflow = 'hidden'
  // showModal помещает окно в top layer: фон недоступен, фокус остаётся внутри.
  dialog.value?.showModal()
})
onBeforeUnmount(() => {
  dialog.value?.close()
  document.documentElement.style.overflow = previousOverflow
})
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" :aria-labelledby="titleId" :aria-describedby="messageId" :aria-busy="busy" @cancel.prevent="cancel" @click="backdropClick">
      <h2 :id="titleId">{{ title }}</h2>
      <p :id="messageId">{{ message }}</p>
      <slot />
      <div class="dialog-actions">
        <button type="button" class="secondary-button" autofocus :disabled="busy" @click="cancel">{{ cancelText ?? text.cancel }}</button>
        <button type="button" class="primary-button" :class="{ destructive }" :disabled="busy || confirmDisabled" @click="confirm">
          {{ busy ? pendingText ?? text.pending : confirmText ?? text.confirm }}
        </button>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
dialog {
  width: min(520px, calc(100% - 36px));
  max-height: calc(100dvh - 48px);
  padding: 28px;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  background: var(--color-background);
  box-shadow: 0 24px 80px #0003;
  overflow: auto;
}
dialog::backdrop { background: #17201bb3; }

h2 {
  overflow-wrap: anywhere;
  margin: 0 0 20px;
  font-size: 24px;
}

p {
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}

.destructive {
  background: var(--color-error);
  border-color: var(--color-error);
}

@media (width <= 480px) {
  dialog { padding: 20px; }

  .dialog-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
