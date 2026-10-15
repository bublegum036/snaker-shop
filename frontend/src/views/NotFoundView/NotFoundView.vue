<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { notFoundViewTexts as text } from './NotFoundView.texts'
</script>

<template>
  <section class="not-found" aria-labelledby="not-found-title">
    <p class="eyebrow">{{ text.code }}</p>
    <h1 id="not-found-title">{{ text.title }}</h1>
    <p class="description">{{ text.description }}</p>
    <RouterLink class="primary-button" :to="{ name: 'catalog' }">{{ text.catalog }}</RouterLink>
  </section>
</template>

<style scoped>
.not-found {
  max-width: 640px;
  margin: 64px auto;
}

h1 {
  margin: 0;
  font-size: clamp(32px, 5vw, 56px);
  line-height: 1.1;
}

.description {
  margin: 24px 0 32px;
  color: var(--color-muted);
  line-height: 1.5;
}

.primary-button {
  display: inline-block;
}
</style>
