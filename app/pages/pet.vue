<script setup lang="ts">
/**
 * 独立桌宠页 `/pet`（浏览器预览 / Electron 透明覆盖层）。
 *
 * 渲染逻辑已经抽到 app/components/PetWidget.vue，与网页主界面右下角那只小羊共用。
 * 这一页只保留「独立页」语义：整页透明、全局禁原生右键、给 Electron 上报可点区域、
 * 浏览器预览带一层淡淡的背景和说明；主界面嵌入形态由 app/app.vue 负责。
 */
</script>

<template>
  <PetWidget />
</template>
