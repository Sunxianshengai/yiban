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
      <div class="jr-set-label" style="padding-left:4px">Default Account</div>
      <div class="jr-cloud-row on">
        <JrIcon :path="mdiLaptop" :size="24" />
        <span style="font-weight:700">Local</span>
      </div>
      <div class="jr-set-label" style="padding-left:4px;margin-top:14px">Other Accounts</div>
      <button class="jr-cloud-row" @click="notice = 'Journey Cloud Sync / Google Drive need a server adapter — see feature matrix F-021. Endpoints recorded in evidence/derived/contracts.json.'">
        <JrIcon :path="mdiPlusBoxOutline" :size="24" />
        <span>Add a New Cloud Service</span>
      </button>
      <button class="jr-cloud-row" @click="notice = 'Account, data and cloud management pending server adapters (F-021/F-022).'">
        <JrIcon :path="mdiCogOutline" :size="24" />
        <span>Manage Account, Data &amp; Cloud Services</span>
      </button>
      <p v-if="notice" class="jr-import-msg">{{ notice }}</p>
      <button class="jr-btn jr-btn-primary" style="width:100%;justify-content:center;margin-top:14px" disabled title="Local journal is always current; cloud sync needs server adapters">
        <JrIcon :path="mdiSync" :size="17" /> Sync All
      </button>
    </div>
  </div>
</template>
