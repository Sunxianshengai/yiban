export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: false,
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  // 高德 Key 的构建期默认值。真值只放本机 .env 或 Vercel 环境变量，
  // 绝不写进仓库（仓库是公开的）；用户在「设置 → 地点」里填的 localStorage 优先级更高。
  runtimeConfig: {
    public: {
      amapWebKey: '',
      amapJsKey: '',
      amapSecurity: '',
    },
  },
  app: {
    head: {
      title: '旅程日记',
      htmlAttrs: { lang: 'zh-CN' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '记录、搜索和回顾日常的日记工具' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
})
