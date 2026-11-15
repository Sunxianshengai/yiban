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
.home-map { width: 236px; padding: 14px; border-radius: 16px; font-size: .82rem; }
.map-header { display: flex; justify-content: space-between; align-items: center; margin: -2px 0 8px 2px; }
.map-header h2 { margin: 0; font-size: .88rem; font-weight: 650; color: #26362c; }
.home-map button { font: inherit; color: inherit; cursor: pointer; }
.map-collapse { display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 8px; background: transparent; color: #4f6055; }
.map-collapse:hover { background: #e3ece5; }
.map-plan { position: relative; aspect-ratio: 10.8 / 7.72; margin: 2px 0 8px; isolation: isolate; }
.map-building { position: absolute; border: 1.5px solid #596b5e; border-radius: 4px; background: #e8eee8; }
.map-room, .map-stairs { display: flex; align-items: center; justify-content: center; position: absolute; border: 1px solid #ffffffc4; padding: 0 1px; border-radius: 3px; white-space: nowrap; }
.map-room span, .map-stairs span { position: relative; z-index: 1; font-size: .68rem; font-weight: 550; padding: 1px 4px; border-radius: 3px; background: #fffffff0; color: #283a2f; }
.map-shape { position: absolute; pointer-events: none; box-sizing: border-box; }
.map-shape.is-rug { background: #c3d8c978; border: 1px dashed #6d8c7860; border-radius: 3px; }
.map-shape.is-furniture { background: #a899824d; border: 1px solid #6b635566; border-radius: 2px; }
.map-shape.is-counter { background: #8da59260; border: 1px solid #536b5978; border-radius: 2px; }
.map-shape.is-fixture { background: #ffffffcc; border: 1px solid #6b766f80; border-radius: 3px; }
.map-shape.is-wall { background: #3f5045; border-radius: 1px; }
.map-shape.is-round { border-radius: 50%; }
.map-room.oak { background: #ece6d7; }
.map-room.sage { background: #cfe0d2; }
.map-room.blue { background: #dbe6e5; }
.map-stairs { flex-direction: column; gap: 3px; background: repeating-linear-gradient(0deg, #dfe6df, #dfe6df 4px, #ecf1ec 4px, #ecf1ec 8px); }
.map-plan button:is(:hover, [aria-current]) { outline: 2px solid #2b513e; outline-offset: -2px; z-index: 1; }
.map-entry { position: absolute; text-align: center; min-width: 29px; font-size: .62rem; color: #546257; }
.map-player { position: absolute; width: 16px; height: 16px; background: #e27834; border: 2px solid #ffffff; clip-path: polygon(50% 0, 100% 90%, 50% 74%, 0 90%); z-index: 2; pointer-events: none; }
.map-floors { display: flex; padding: 3px; gap: 2px; border-radius: 10px; background: #e7ede8; }
.map-floors button { flex: 1; min-height: 32px; border: 0; border-radius: 7px; background: transparent; font-size: .76rem; }
.map-floors button:hover { background: #f2f7f3; }
.map-floors button[aria-pressed="true"] { color: #ffffff; background: #2b513e; font-weight: 600; }
.map-status { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin: 8px 2px 0; color: #526157; font-size: .71rem; }
.map-status-now { display: inline-flex; align-items: center; gap: 5px; }
.map-status-now i { width: 7px; height: 7px; border-radius: 50%; background: #e27834; }
.map-status-tip { color: #7a877d; font-size: .68rem; }
@media (max-height: 680px) { .home-map { width: 204px; padding: 10px; } }
</style>
