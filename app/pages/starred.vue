<script setup lang="ts">
import { mdiStarOutline, mdiFilterVariant, mdiImageOutline } from '@mdi/js'
import { db } from '~/utils/db'
import type { EntryV2 } from '~/utils/db'

const { entries: all } = useEntries()
const starred = computed(() => all.value.filter((e) => !!e.favourite))
void db
</script>

<template>
  <div class="jr-content">
    <div class="jr-list-col">
      <div style="display:flex;align-items:center;gap:10px;margin:22px 0 0">
        <button class="jr-search" style="margin:0;padding:7px 12px;font-size:12px;font-weight:700;letter-spacing:.4px">
          <JrIcon :path="mdiFilterVariant" :size="15" /> FILTERS
        </button>
        <div class="jr-search" style="margin:0"><input type="text" placeholder="Search" /></div>
      </div>
      <h1 style="font-size:19px;margin:22px 0 10px">Search Results</h1>
      <div v-if="!starred.length" class="jr-empty">
        <div class="big"><JrIcon :path="mdiStarOutline" :size="46" /></div>
        No entries to display.
      </div>
      <div v-for="e in starred" :key="e.id" class="jr-entry">
        <div class="date">{{ e.previewText?.slice(0, 40) }}</div>
        <div class="preview">{{ e.previewText }}</div>
      </div>
      <p v-if="starred.length" class="jr-muted" style="font-size:12px">Starred = filtered search view, per original (evidence: page-starred-search-results.png).</p>
    </div>
    <div class="jr-detail-col" style="display:flex;align-items:center;justify-content:center">
      <div class="jr-empty">
        <div class="big"><JrIcon :path="mdiImageOutline" :size="46" /></div>
        No entries selected.
      </div>
    </div>
  </div>
</template>
