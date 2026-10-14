<template>
  <footer class="site-footer">
    <span>NORTH / SNEAKER STORE</span>
    <span>Найди свою пару.</span>
  </footer>
</template>

<style scoped>
.site-footer {
  margin-top: 70px;
  padding: 28px 0;
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--color-muted);
}

@media (max-width: 600px) {
  .site-footer {
    margin-top: 45px;
    gap: 20px;
  }
}
</style>
