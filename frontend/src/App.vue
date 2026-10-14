<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <header class="site-header">
    <RouterLink class="wordmark" to="/" aria-label="North — главная">north<span>®</span></RouterLink>
    <nav aria-label="Основная навигация"><RouterLink to="/">Каталог</RouterLink></nav>
    <span class="header-note">Кроссовки на каждый день</span>
  </header>
  <main><RouterView /></main>
  <footer class="site-footer"><span>NORTH / SNEAKER STORE</span><span>Найди свою пару.</span></footer>
</template>
