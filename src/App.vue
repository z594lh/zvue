<template>
  <div id="app">
    <NavBar v-if="['/ai-image', '/gallery', '/expense'].includes($route.path)" />
    <router-view />
  </div>
</template>

<script>
import NavBar from '@/components/Navbar.vue'

export default {
  name: 'App',
  components: {
    NavBar
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: #f5f7fa;
}
</style>
