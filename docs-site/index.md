---
layout: home
---

<script setup>
import { onMounted } from 'vue'
import { useRouter, withBase } from 'vitepress'

const router = useRouter()

onMounted(() => {
  // Auto-redirect to English docs (使用 withBase 确保路径正确)
  window.location.href = withBase('/en/')
})
</script>

# Agent Builder

Redirecting to documentation...
