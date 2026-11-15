<script setup lang="ts">
import { mdiMinus, mdiStairs } from '@mdi/js'
import { halfDepth, halfWidth, houseDepth, houseLevels, houseStops, houseWidth, mapPlanShapes, mapRooms, porch, stairs, stairStops, type Bounds2D, type HouseStop } from '~/utils/familyHouseLayout'
import type { HouseFloor, HousePosition, HouseView } from '~/utils/familyHouseScene'

const props = defineProps<{ floor: HouseFloor; view: HouseView; position: HousePosition; room: string }>()
const emit = defineEmits<{ floor: [HouseFloor]; visit: [HouseStop]; hide: [] }>()
const mapFloor = computed(() => props.floor === 'all' ? 0 : props.floor)
const planShapes = computed(() => mapPlanShapes[mapFloor.value] ?? [])
const showPlayer = computed(() => props.view === 'walk' && props.position.floor === mapFloor.value)
const depth = houseDepth + 1.12
const xPercent = (x: number) => (x + halfWidth) / houseWidth * 100
const zPercent = (z: number) => (z + halfDepth + .02) / depth * 100
const outline = (box: Bounds2D) => ({
  left: `${xPercent(box.left)}%`, top: `${zPercent(box.back)}%`,
  width: `${xPercent(box.right) - xPercent(box.left)}%`, height: `${zPercent(box.front) - zPercent(box.back)}%`,
})
function visit(id: string) {
  const stop = houseStops.find(item => item.id === id)
  if (stop) emit('visit', stop)
}
</script>

<template>
  <aside class="home-map" aria-labelledby="home-map-title">
    <div class="map-header">
      <h2 id="home-map-title">房间导航</h2>
      <button type="button" class="map-collapse" title="收起小地图" aria-label="收起小地图" @click="emit('hide')"><JrIcon :path="mdiMinus" :size="17" /></button>
    </div>
    <div class="map-plan" :aria-label="`${houseLevels[mapFloor]}平面图`">
      <div class="map-building" :style="outline({ left: -halfWidth, right: halfWidth, back: -halfDepth, front: halfDepth })" />
      <button v-for="area in mapRooms[mapFloor]" :key="area.stop" type="button" class="map-room" :class="area.color" :style="outline(area)"
        :aria-label="`去${houseStops.find(item => item.id === area.stop)?.label}`" :aria-current="view === 'walk' && room === area.stop ? 'location' : undefined" @click="visit(area.stop)">
        <span>{{ area.short }}</span>
      </button>
      <span v-for="(shape, idx) in planShapes" :key="idx" class="map-shape" :class="[`is-${shape.kind}`, { 'is-round': shape.round }]"
        :style="outline(shape)" aria-hidden="true" />
      <button type="button" class="map-stairs" :style="outline({ left: stairs.left, right: stairs.right, back: -halfDepth + .14, front: halfDepth - .14 })"
        :aria-label="`去${houseLevels[mapFloor]}楼梯口`" :aria-current="view === 'walk' && (room === 'stairs' || room === `stair-${mapFloor}`) ? 'location' : undefined"
        @click="emit('visit', stairStops[mapFloor]!)"><JrIcon :path="mdiStairs" :size="16" /><span>楼梯</span></button>
      <span v-if="mapFloor === 0" class="map-entry" :style="outline({ left: porch.position[0] - .64, right: porch.position[0] + .64, back: halfDepth - .04, front: halfDepth + .32 })">入户</span>
      <span v-if="showPlayer" class="map-player" aria-hidden="true"
        :style="{ left: `${xPercent(position.x)}%`, top: `${zPercent(position.z)}%`, transform: `translate(-50%, -50%) rotate(${-position.yaw}rad)` }" />
    </div>
    <div class="map-floors" role="group" aria-label="楼层">
      <button v-if="view === 'overview'" type="button" :aria-pressed="floor === 'all'" @click="emit('floor', 'all')">整栋</button>
      <button v-for="(name, index) in houseLevels" :key="name" type="button" :aria-pressed="floor === index" @click="emit('floor', index)">{{ name }}</button>
    </div>
    <div v-if="view === 'walk'" class="map-status">
      <span class="map-status-now"><i aria-hidden="true" />{{ position.onStairs ? '楼梯间' : '你的位置' }}</span>
      <span class="map-status-tip">点击房间前往</span>
    </div>
  </aside>
</template>

<style scoped>
.home-map { width: 246px; padding: 12px; border-radius: 13px; font-size: .83rem; }
.map-header { display: flex; justify-content: space-between; align-items: center; margin: -3px -2px 5px 1px; }
.map-header h2 { margin: 0; font-size: .86rem; }
.home-map button { font: inherit; color: inherit; cursor: pointer; }
.map-collapse { display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 7px; background: transparent; }
.map-collapse:hover { background: #dfebe0; }
.map-plan { position: relative; aspect-ratio: 10.8 / 7.72; margin: 2px 0 6px; isolation: isolate; }
.map-building { position: absolute; border: 1.5px solid #6f8174; border-radius: 3px; background: #e6ece3; }
.map-room, .map-stairs { display: flex; align-items: center; justify-content: center; position: absolute; border: 1px solid #fffcf5; padding: 0 1px; border-radius: 3px; white-space: nowrap; }
.map-room span, .map-stairs span { position: relative; z-index: 1; font-size: .70rem; padding: 1px 4px; border-radius: 3px; background: #fffdf8bd; }
.map-shape { position: absolute; pointer-events: none; box-sizing: border-box; }
.map-shape.is-rug { background: #cbbda65c; border: 1px dashed #8a7e6a59; border-radius: 3px; }
.map-shape.is-furniture { background: #a899825c; border: 1px solid #6b63557a; border-radius: 2px; }
.map-shape.is-counter { background: #8da59270; border: 1px solid #536b598a; border-radius: 2px; }
.map-shape.is-fixture { background: #f9f7f2bf; border: 1px solid #6b766f94; border-radius: 3px; }
.map-shape.is-wall { background: #4a5a4e; border-radius: 1px; }
.map-shape.is-round { border-radius: 50%; }
.map-room.oak { background: #ecdfca; }
.map-room.sage { background: #dce7d7; }
.map-room.blue { background: #e2e9e8; }
.map-stairs { flex-direction: column; gap: 3px; background: repeating-linear-gradient(0deg, #e3e6da, #e3e6da 4px, #edf0e6 4px, #edf0e6 8px); }
.map-plan button:is(:hover, [aria-current]) { outline: 2px solid #567660; outline-offset: -2px; z-index: 1; }
.map-entry { position: absolute; text-align: center; min-width: 29px; font-size: .63rem; color: #5b6456; }
.map-player { position: absolute; width: 17px; height: 17px; background: #294a37; border: 2px solid #fff8e9; clip-path: polygon(50% 0, 100% 90%, 50% 74%, 0 90%); z-index: 2; pointer-events: none; }
.map-floors { display: flex; padding: 3px; gap: 2px; border-radius: 8px; background: #e7eae0; }
.map-floors button { flex: 1; min-height: 36px; border: 0; border-radius: 6px; background: transparent; }
.map-floors button:hover { background: #edf3e9; }
.map-floors button[aria-pressed="true"] { color: #fffdf7; background: #47634f; }
.map-status { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin: 8px 3px 0; color: #555d51; font-size: .72rem; }
.map-status-now { display: inline-flex; align-items: center; gap: 6px; }
.map-status-now i { width: 6px; height: 6px; border-radius: 50%; background: #355841; }
.map-status-tip { color: #757e70; font-size: .68rem; }
@media (max-height: 680px) { .home-map { width: 212px; padding: 9px; } }
</style>
