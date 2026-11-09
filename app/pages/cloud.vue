<script setup lang="ts">
import { mdiClose, mdiLaptop, mdiCloudOutline, mdiPlusBoxOutline, mdiCogOutline, mdiSync } from '@mdi/js'

/** Journal picker, faithful to the captured Cloud Services dialog (page-cloud-services.png).
 *  Local is real; cloud rows are honestly unavailable (no Journey server cloned). */
const notice = ref('')
</script>

<template>
  <div class="jr-modal-mask" @click.self="$router.back()">
    <div class="jr-modal jr-cloud-modal">
      <button class="jr-modal-x" @click="$router.back()"><JrIcon :path="mdiClose" :size="16" /></button>
      <div class="jr-set-label" style="padding-left:4px">默认账号</div>
      <div class="jr-cloud-row on">
        <JrIcon :path="mdiLaptop" :size="24" />
        <span style="font-weight:700">本机</span>
      </div>
      <div class="jr-set-label" style="padding-left:4px;margin-top:14px">其他账号</div>
      <button class="jr-cloud-row" @click="notice = '云同步和谷歌云端硬盘暂未接入。'">
        <JrIcon :path="mdiPlusBoxOutline" :size="24" />
        <span>添加云服务</span>
      </button>
      <button class="jr-cloud-row" @click="notice = '在线账号与云服务管理暂不可用。'">
        <JrIcon :path="mdiCogOutline" :size="24" />
        <span>管理账号、数据与云服务</span>
      </button>
      <p v-if="notice" class="jr-import-msg">{{ notice }}</p>
      <button class="jr-btn jr-btn-primary" style="width:100%;justify-content:center;margin-top:14px" disabled title="本机日记已是最新状态。云同步暂不可用。">
        <JrIcon :path="mdiSync" :size="17" /> 全部同步
      </button>
    </div>
  </div>
</template>
