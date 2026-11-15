import {
  ACESFilmicToneMapping, Color, DirectionalLight, Euler, Float32BufferAttribute, Group, HemisphereLight, MathUtils,
  Mesh, OrthographicCamera, PCFShadowMap, PerspectiveCamera, PMREMGenerator, Scene, Texture, Vector3, WebGLRenderer,
  type BufferAttribute, type BufferGeometry, type Material, type Object3D,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import deskLampUrl from '~/assets/family-house/models/desk-lamp.glb?url'
import deskUrl from '~/assets/family-house/models/desk.glb?url'
import dualMonitorsUrl from '~/assets/family-house/models/dual-monitors.glb?url'
import ergoChairUrl from '~/assets/family-house/models/ergo-chair.glb?url'
import keyboardMouseUrl from '~/assets/family-house/models/keyboard-mouse.glb?url'
import patioTableUrl from '~/assets/family-house/models/patio-table.glb?url'
import petBedUrl from '~/assets/family-house/models/pet-bed.glb?url'
import petDogUrl from '~/assets/family-house/models/pet-dog.glb?url'
import smallPlantUrl from '~/assets/family-house/models/small-plant.glb?url'
import tallPlantUrl from '~/assets/family-house/models/tall-plant.glb?url'
import bookshelfUrl from '~/assets/family-house/models/bookshelf.glb?url'
import floorLampUrl from '~/assets/family-house/models/floor-lamp.glb?url'
import coffeeMakerUrl from '~/assets/family-house/models/coffee-maker.glb?url'
import microwaveUrl from '~/assets/family-house/models/microwave.glb?url'
import bathtubUrl from '~/assets/family-house/models/bathtub.glb?url'
import toiletUrl from '~/assets/family-house/models/toilet.glb?url'
import sideboardUrl from '~/assets/family-house/models/sideboard.glb?url'
import petBowlsUrl from '~/assets/family-house/models/pet-bowls.glb?url'
import catTreeUrl from '~/assets/family-house/models/cat-tree.glb?url'
import tvUnitUrl from '~/assets/family-house/models/tv-unit.glb?url'
import shoeRackUrl from '~/assets/family-house/models/shoe-rack.glb?url'
import { buildFamilyHouse, sceneBackdrop } from './familyHouseModel'

const extraModelUrls: Record<string, string> = {
  'ergo-chair': ergoChairUrl,
  'desk': deskUrl,
  'dual-monitors': dualMonitorsUrl,
  'keyboard-mouse': keyboardMouseUrl,
  'desk-lamp': deskLampUrl,
  'tall-plant': tallPlantUrl,
  'small-plant': smallPlantUrl,
  'pet-dog': petDogUrl,
  'pet-bed': petBedUrl,
  'patio-table': patioTableUrl,
  'bookshelf': bookshelfUrl,
  'floor-lamp': floorLampUrl,
  'coffee-maker': coffeeMakerUrl,
  'microwave': microwaveUrl,
  'bathtub': bathtubUrl,
  'toilet': toiletUrl,
  'sideboard': sideboardUrl,
  'pet-bowls': petBowlsUrl,
  'cat-tree': catTreeUrl,
  'tv-unit': tvUnitUrl,
  'shoe-rack': shoeRackUrl,
}
import { blocksWalk, floorRise, halfDepth, halfWidth, hasStairFootprint, houseStops, porch, stairHeight, stairLane, stairs, stairStops, type HouseStop } from './familyHouseLayout'

export type HouseView = 'overview' | 'walk'
type HouseDirection = 'forward' | 'back' | 'left' | 'right'
export type HouseFloor = number | 'all'
export interface HousePosition { x: number; z: number; yaw: number; floor: number; onStairs: boolean }
interface WalkSurface { floor: number; height: number; stairBase: number | null }
export interface HouseHint { id: string; label: string; kind: 'door' | 'light' | 'pet' }
export interface HousePetState { floor: number; moving: boolean; called: boolean; roomLabel: string }

const moveKeys = new Map<string, HouseDirection>([
  ['KeyW', 'forward'], ['ArrowUp', 'forward'], ['KeyS', 'back'], ['ArrowDown', 'back'],
  ['KeyA', 'left'], ['ArrowLeft', 'left'], ['KeyD', 'right'], ['ArrowRight', 'right'],
])
const stopsByFloor = stairStops.map(stair => [...houseStops.filter(stop => stop.floor === stair.floor), stair])
const walkSpeed = 1.9
const stairSpeed = 1.55
const baseLookSensitivity = .0039
const movementEpsilon = .006

function batchStaticMeshes(group: Group, excluded: Set<Object3D>) {
  const batches = new Map<string, { material: Material; objects: Mesh[] }>()
  group.updateWorldMatrix(true, true)
  const inverse = group.matrixWorld.clone().invert()
  function collect(object: Object3D) {
    if (excluded.has(object)) return
    if (object instanceof Mesh && !Array.isArray(object.material) && !object.material.transparent) {
      const mesh = object as Mesh<BufferGeometry, Material>
      const { geometry } = mesh
      const signature = Object.entries(geometry.attributes).sort(([left], [right]) => left.localeCompare(right))
        .map(([name, attribute]) => [name, attribute.itemSize,
          name === 'position' || name === 'normal' || name === 'tangent' ? 'float' : attribute.array.constructor.name,
          name === 'position' || name === 'normal' || name === 'tangent' ? false : attribute.normalized].join('/'))
      const key = [mesh.material.uuid, Boolean(geometry.index), ...signature].join('|')
      const batch = batches.get(key) ?? { material: mesh.material, objects: [] }
      batch.objects.push(mesh)
      batches.set(key, batch)
    }
    for (const child of object.children) collect(child)
  }
  collect(group)
  for (const batch of batches.values()) {
    if (batch.objects.length < 2) continue
    const pieces = batch.objects.map(object => {
      const geometry = object.geometry.clone()
      // The source GLB may quantize these attributes. World transforms need a float destination.
      for (const name of ['position', 'normal', 'tangent']) {
        const attribute = geometry.getAttribute(name) as BufferAttribute | undefined
        if (!attribute || attribute.array instanceof Float32Array) continue
        const data = new Float32Array(attribute.count * attribute.itemSize)
        for (let i = 0; i < attribute.count; i++) for (let j = 0; j < attribute.itemSize; j++)
          data[i * attribute.itemSize + j] = attribute.getComponent(i, j)
        geometry.setAttribute(name, new Float32BufferAttribute(data, attribute.itemSize))
      }
      return geometry.applyMatrix4(inverse.clone().multiply(object.matrixWorld))
    })
    const geometry = mergeGeometries(pieces)
    for (const piece of pieces) piece.dispose()
    if (!geometry) continue
    const rendered = new Mesh(geometry, batch.material)
    rendered.userData.renderBatch = true
    group.add(rendered)
    for (const object of batch.objects) object.visible = false
  }
}

function disposeTrees(...roots: Group[]) {
  const resources = new Set<{ dispose: () => void }>()
  for (const root of roots) root.traverse(object => {
    if (!(object instanceof Mesh)) return
    resources.add(object.geometry)
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      resources.add(material)
      for (const value of Object.values(material)) if (value instanceof Texture) resources.add(value)
    }
  })
  for (const item of resources) item.dispose()
}

export async function createFamilyHouseScene(canvas: HTMLCanvasElement, url: string, options: {
  signal: AbortSignal
  onRoom: (id: string) => void
  onPosition: (position: HousePosition) => void
  onHint: (hint: HouseHint | null) => void
  onLock: (locked: boolean) => void
  onPet?: (pet: HousePetState) => void
}) {
  const loader = new GLTFLoader()
  const response = await fetch(url, { signal: options.signal })
  if (!response.ok) throw new Error(`Furniture download failed (${response.status})`)
  const source = (await loader.parseAsync(await response.arrayBuffer(), url)).scene
  const extras: Record<string, Group | null> = {}
  const extraRoots: Group[] = []
  await Promise.all(Object.entries(extraModelUrls).map(async ([key, assetUrl]) => {
    try {
      const res = await fetch(assetUrl, { signal: options.signal })
      if (!res.ok) { extras[key] = null; return }
      const loaded = (await loader.parseAsync(await res.arrayBuffer(), assetUrl)).scene
      extras[key] = loaded
      extraRoots.push(loaded)
    } catch {
      extras[key] = null
    }
  }))
  let renderer: WebGLRenderer
  try {
    options.signal.throwIfAborted()
    renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  } catch (error) {
    disposeTrees(source, ...extraRoots)
    throw error
  }

  const scene = new Scene()
  scene.background = sceneBackdrop.clone()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65))
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  let model: ReturnType<typeof buildFamilyHouse>
  try { model = buildFamilyHouse(source, extras) }
  catch (error) { renderer.dispose(); disposeTrees(source, ...extraRoots); throw error }
  scene.add(model.house)
  const dynamic = new Set<Object3D>(model.doors.map(door => door.hinge))
  for (const floor of model.floors) dynamic.add(floor.front)
  for (const floor of model.floors) {
    batchStaticMeshes(floor.root, dynamic)
    batchStaticMeshes(floor.front, new Set(model.doors.map(door => door.hinge)))
  }
  batchStaticMeshes(model.ground, dynamic)
  batchStaticMeshes(model.roof, dynamic)

  const environment = new RoomEnvironment()
  const generator = new PMREMGenerator(renderer)
  const environmentMap = generator.fromScene(environment, .036)
  generator.dispose()
  environment.dispose()
  scene.environment = environmentMap.texture
  const sun = new DirectionalLight('#fff1dd', 2.45)
  sun.position.set(-3, 12, 8)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: .5, far: 29 })
  sun.shadow.normalBias = .035
  sun.shadow.bias = -.00012
  sun.shadow.radius = 2
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  renderer.shadowMap.autoUpdate = false
  model.house.traverse(object => {
    if (!(object instanceof Mesh)) return
    const mats = Array.isArray(object.material) ? object.material : [object.material]
    object.castShadow = mats.every(mat => !mat.transparent)
    object.receiveShadow = true
  })
  const ambient = new HemisphereLight('#fff7ee', '#afa69a', 1.22)
  scene.add(sun, sun.target, ambient)

  const overview = new OrthographicCamera(-8, 8, 6, -6, .025, 90)
  const player = new PerspectiveCamera(65, 1, .035, 75)
  player.rotation.order = 'YXZ'
  const orbit = new OrbitControls(overview, canvas)
  orbit.enablePan = false
  orbit.minZoom = .52
  orbit.maxZoom = 2.70
  orbit.maxPolarAngle = Math.PI / 2 - .045

  let mode: HouseView = 'walk'
  let displayedFloor: HouseFloor = 'all'
  let currentFloor = 0
  let exterior = false
  let lampsOn = true
  let evening = false
  let stairBase: number | null = null
  let shownFloor = 0
  let hint: HouseHint | null = null
  let currentRoom = ''
  let yaw = 0
  let pitch = 0
  let targetYaw = 0
  let targetPitch = 0
  let lookSensitivity = baseLookSensitivity
  let eyeHeight = 1.62
  let mapUpdatedAt = -Infinity
  let dirty = true
  let pointer: { id: number; x: number; y: number } | undefined
  let pointerLocked = false
  const held = new Map<string, HouseDirection>()
  const desiredVelocity = new Vector3()
  const walkVelocity = new Vector3()
  const heading = new Euler(0, 0, 0, 'YXZ')
  const openDoors = new Set<string>()
  const switchedOff = new Set<string>()
  const switchId = new Map(model.localLamps.map(lamp => [lamp.light, lamp.id]))
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  function resize() {
    const { clientWidth, clientHeight } = canvas
    if (!clientWidth || !clientHeight) return
    renderer.setSize(clientWidth, clientHeight, false)
    const aspect = clientWidth / clientHeight
    const halfHeight = Math.max(5.9, 7.25 / aspect)
    overview.left = -halfHeight * aspect
    overview.right = halfHeight * aspect
    overview.top = halfHeight
    overview.bottom = -halfHeight
    overview.updateProjectionMatrix()
    player.aspect = aspect
    player.fov = aspect < 1 ? 78 : 64
    player.updateProjectionMatrix()
    dirty = true
  }
  function refreshScene() {
    const walking = mode === 'walk'
    for (const [index, floor] of model.floors.entries()) {
      floor.root.visible = walking ? Math.abs(index - shownFloor) <= 1 : displayedFloor === 'all' || displayedFloor === index
      floor.front.visible = walking || exterior
      for (const light of floor.lights) light.visible = lampsOn && (!walking || index === shownFloor)
        && !switchedOff.has(switchId.get(light) ?? '')
    }
    for (const mat of model.emissiveMaterials) {
      mat.emissiveIntensity = lampsOn ? (evening ? 1.55 : .95) : 0
    }
    model.ground.visible = walking || displayedFloor === 'all'
    model.roof.visible = (walking && shownFloor === 3) || exterior
    scene.background = evening ? new Color('#424e66') : walking ? new Color('#dce7e6') : sceneBackdrop
    scene.environmentIntensity = evening ? .26 : walking ? .68 : .52
    const targetY = walking ? shownFloor * floorRise : 3.5
    sun.target.position.set(0, targetY, 0)
    sun.target.updateMatrixWorld()
    sun.position.set(-3, targetY + 12, 8)
    sun.color.set(evening ? '#a3b7e2' : '#fff1dd')
    sun.intensity = evening ? (walking ? .24 : .72) : walking ? 1.15 : 2.35
    sun.castShadow = true
    ambient.color.set(evening ? '#cddeff' : '#fff7ee')
    ambient.intensity = evening ? (walking ? .52 : .68) : walking ? 1.24 : 1.24
    renderer.shadowMap.needsUpdate = true
    dirty = true
  }
  function resetOrbit() {
    const y = displayedFloor === 'all' ? 4.8 : displayedFloor * floorRise + .78
    orbit.target.set(0, y, displayedFloor === 'all' ? .35 : 0)
    if (displayedFloor === 'all') overview.position.set(8.6, y + (exterior ? 9.5 : 5.6), 21)
    else overview.position.set(8.3, y + 12.6, 16)
    overview.zoom = displayedFloor === 'all' ? (exterior ? .72 : .76) : .92
    overview.updateProjectionMatrix()
    orbit.update()
    dirty = true
  }
  function nearestRoom() {
    if (stairBase !== null || player.position.z > halfDepth + .04) {
      const id = stairBase === null ? 'porch' : 'stairs'
      if (id !== currentRoom) { currentRoom = id; options.onRoom(id) }
      return
    }
    let closest: HouseStop | undefined
    let distance = Infinity
    for (const stop of stopsByFloor[currentFloor]!) {
      const d = Math.hypot(player.position.x - stop.position[0], player.position.z - stop.position[1])
      if (d < distance) { closest = stop; distance = d }
    }
    if (closest && currentRoom !== closest.id) {
      currentRoom = closest.id
      options.onRoom(currentRoom)
    }
  }
  function updateHint() {
    let next: HouseHint | null = null
    let closest = 1.72
    if (mode === 'walk' && stairBase === null) {
      for (const door of model.doors) {
        if (door.floor !== currentFloor) continue
        const distance = Math.hypot(player.position.x - door.x, player.position.z - door.z)
        const ahead = (door.x - player.position.x) * -Math.sin(yaw) + (door.z - player.position.z) * -Math.cos(yaw)
        if (distance >= closest || (distance > .72 && ahead < distance * -.25)) continue
        closest = distance
        const opening = openDoors.has(door.id) && Math.abs(Math.PI / 2 - door.hinge.rotation.y) > .08
        next = {
          id: door.id,
          kind: 'door',
          label: opening ? `${door.label} · 正在打开` : `${openDoors.has(door.id) ? '关上' : '打开'}${door.label}`,
        }
      }
      for (const lamp of model.localLamps) {
        if (!lampsOn || lamp.floor !== currentFloor) continue
        const distance = Math.hypot(player.position.x - lamp.x, player.position.z - lamp.z)
        if (distance >= closest) continue
        closest = distance
        next = { id: lamp.id, kind: 'light', label: `${switchedOff.has(lamp.id) ? '打开' : '关掉'}${lamp.label}` }
      }
      if (petState.floor === currentFloor) {
        const petDist = Math.hypot(player.position.x - petState.x, player.position.z - petState.z)
        if (petDist < Math.min(closest, 1.45)) {
          next = { id: 'pet', kind: 'pet', label: '摸摸小柴' }
        }
      }
    }
    if (hint?.id !== next?.id || hint?.label !== next?.label) { hint = next; options.onHint(hint) }
  }
  function reportPosition(time = performance.now(), immediate = false) {
    if (!immediate && time - mapUpdatedAt < 32) return
    mapUpdatedAt = time
    options.onPosition({ x: player.position.x, z: player.position.z, yaw, floor: shownFloor, onStairs: stairBase !== null })
  }
  function ease(current: number, target: number, rate: number, delta: number, epsilon: number) {
    const value = MathUtils.damp(current, target, rate, delta)
    return Math.abs(value - target) <= epsilon ? target : value
  }
  function turn(delta: number) {
    if (yaw === targetYaw && pitch === targetPitch) return false
    yaw = reducedMotion.matches ? targetYaw : ease(yaw, targetYaw, 47, delta, .00008)
    pitch = reducedMotion.matches ? targetPitch : ease(pitch, targetPitch, 47, delta, .00008)
    player.rotation.set(pitch, yaw, 0, 'YXZ')
    return true
  }
  function enter(stop: HouseStop) {
    currentFloor = stop.floor
    shownFloor = stop.floor
    stairBase = null
    clearKeys()
    eyeHeight = 1.62 + stop.floor * floorRise - (stop.id === 'porch' ? .14 : 0)
    player.position.set(stop.position[0], eyeHeight, stop.position[1])
    yaw = targetYaw = Math.atan2(stop.position[0] - stop.look[0], stop.position[1] - stop.look[1])
    pitch = targetPitch = -.10
    player.rotation.set(pitch, yaw, 0, 'YXZ')
    currentRoom = stop.id
    options.onRoom(stop.id)
    reportPosition(undefined, true)
    updateHint()
    refreshScene()
  }
  function setView(view: HouseView, floor: HouseFloor, showExterior = false) {
    const needsReset = mode !== view || floor !== displayedFloor || showExterior !== exterior
    mode = view
    displayedFloor = floor
    exterior = showExterior
    orbit.enabled = mode === 'overview'
    if (mode === 'overview') { clearKeys(); releaseLook() }
    if (needsReset && mode === 'overview') resetOrbit()
    updateHint()
    refreshScene()
  }
  function canStand(x: number, z: number, floor: number) {
    if (x < -(halfWidth - .27) || x > halfWidth - .33 || z < -(halfDepth - .25)) return false
    if (z > halfDepth - .22 && (floor !== 0 || x < porch.position[0] - .46 || x > porch.position[0] + .46 || z > halfDepth + 1.07)) return false
    if (model.doors.some(door => door.floor === floor && blocksWalk(x, z, openDoors.has(door.id) ? door.open : door.closed))) return false
    return !model.floors[floor]!.solids.some(bounds => blocksWalk(x, z, bounds))
  }
  function walkSurface(x: number, z: number): WalkSurface | undefined {
    const lane = stairLane(x)
    const onFlight = hasStairFootprint(x, z)
    if (stairBase !== null && !onFlight && z >= stairs.front) {
      const floor = stairBase + Number(lane === 'down')
      if (canStand(x, z, floor)) return { floor, height: floor * floorRise, stairBase: null }
      return
    }
    if (onFlight || stairBase !== null) {
      if (x < stairs.left + .17 || x > stairs.right - .19 || z < stairs.back + .17 || z >= stairs.front) return
      if (z > stairs.turn - .16 && Math.abs(x - stairs.middle) < .145) return
      if (stairBase === null && player.position.z < stairs.front) return
      const lower = stairBase ?? (currentFloor - Number(lane === 'down'))
      if (lower < 0 || lower >= model.floors.length - 1) return
      return { floor: currentFloor, stairBase: lower, height: stairHeight(x, z, lower) }
    }
    if (canStand(x, z, currentFloor)) return { floor: currentFloor, height: floorRise * currentFloor, stairBase: null }
  }
  function step(x: number, z: number) {
    const surface = walkSurface(x, z)
    if (!surface) return false
    currentFloor = surface.floor
    stairBase = surface.stairBase
    const porchDrop = surface.floor === 0 && z > halfDepth + .25 ? Math.min(.14, (z - (halfDepth + .25)) * .75) : 0
    eyeHeight = 1.62 + surface.height - porchDrop
    player.position.x = x
    player.position.z = z
    const floor = Math.round(surface.height / floorRise)
    if (floor !== shownFloor) { shownFloor = floor; refreshScene() }
    return true
  }
  function move(delta: number) {
    if (!held.size && !walkVelocity.lengthSq()) return false
    const directions = new Set(held.values())
    const horizontal = Number(directions.has('right')) - Number(directions.has('left'))
    const forward = Number(directions.has('back')) - Number(directions.has('forward'))
    heading.y = yaw
    const substeps = Math.max(1, Math.ceil(delta / .018))
    const slice = delta / substeps
    const response = horizontal || forward ? 21 : 28
    const { x: startX, z: startZ } = player.position
    desiredVelocity.set(horizontal, 0, forward).normalize().applyEuler(heading)
      .multiplyScalar(stairBase === null ? walkSpeed : stairSpeed)
    for (let i = 0; i < substeps; i++) {
      walkVelocity.x = ease(walkVelocity.x, desiredVelocity.x, response, slice, movementEpsilon)
      walkVelocity.z = ease(walkVelocity.z, desiredVelocity.z, response, slice, movementEpsilon)
      const dx = walkVelocity.x * slice
      const dz = walkVelocity.z * slice
      if (!dx && !dz) continue
      const { x, z } = player.position
      if (dx && dz && step(x + dx, z + dz)) continue
      if (dx && !step(x + dx, z)) walkVelocity.x = 0
      if (dz && !step(player.position.x, z + dz)) walkVelocity.z = 0
    }
    return player.position.x !== startX || player.position.z !== startZ
  }
  function animateWalk(delta: number, time: number) {
    const previousFloor = shownFloor
    const onStairs = stairBase !== null
    const turned = turn(delta)
    const moved = move(delta)
    if (moved) nearestRoom()
    if (moved || turned) {
      updateHint()
      reportPosition(time, shownFloor !== previousFloor || onStairs !== (stairBase !== null)
        || (!held.size && !walkVelocity.lengthSq()) || (turned && yaw === targetYaw && pitch === targetPitch))
      dirty = true
    }
    if (player.position.y !== eyeHeight) {
      player.position.y = reducedMotion.matches ? eyeHeight : ease(player.position.y, eyeHeight, 23, delta, .0005)
      dirty = true
    }
  }
  // 宠物小柴犬状态与漫步逻辑
  const petState = {
    floor: 0, x: -1.75, z: .55, yaw: .4,
    targetX: .25, targetZ: 1.85,
    wait: 1.5, called: false, moving: true, happyUntil: 0, phase: 0,
  }
  function pickPetWaypoint(floor: number) {
    const candidates = houseStops.filter(s => s.floor === floor)
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    return pick ? pick.position : [0, 1.5] as [number, number]
  }
  function nearestPetRoom() {
    let best = houseStops.find(s => s.floor === petState.floor)
    let bestDist = Infinity
    for (const s of houseStops) {
      if (s.floor !== petState.floor) continue
      const d = Math.hypot(petState.x - s.position[0], petState.z - s.position[1])
      if (d < bestDist) { best = s; bestDist = d }
    }
    return best?.label ?? '家里'
  }
  function emitPetState() {
    options.onPet?.({ floor: petState.floor, moving: petState.moving, called: petState.called, roomLabel: nearestPetRoom() })
  }
  function callPet() {
    const targetFloor = mode === 'walk' ? shownFloor : (displayedFloor === 'all' ? 0 : displayedFloor)
    if (petState.floor !== targetFloor) {
      petState.floor = targetFloor
      const stair = stairStops[targetFloor]
      petState.x = stair ? stair.position[0] : 0
      petState.z = stair ? stair.position[1] : 1.5
    }
    if (mode === 'walk') {
      const forwardX = -Math.sin(yaw) * 1.15
      const forwardZ = -Math.cos(yaw) * 1.15
      const tx = player.position.x + forwardX
      const tz = player.position.z + forwardZ
      if (canStand(tx, tz, targetFloor)) {
        petState.targetX = tx
        petState.targetZ = tz
      } else {
        petState.targetX = player.position.x
        petState.targetZ = player.position.z
      }
    } else {
      const [tx, tz] = pickPetWaypoint(targetFloor)
      petState.targetX = tx
      petState.targetZ = tz
    }
    petState.wait = 0
    petState.called = true
    petState.moving = true
    emitPetState()
    dirty = true
  }
  function updatePet(delta: number, time: number) {
    const petVisible = mode === 'walk'
      ? Math.abs(petState.floor - shownFloor) <= 1
      : displayedFloor === 'all' || displayedFloor === petState.floor
    model.pet.root.visible = petVisible
    if (!petVisible) return

    const dx = petState.targetX - petState.x
    const dz = petState.targetZ - petState.z
    const dist = Math.hypot(dx, dz)
    const baseY = petState.floor * floorRise
    if (dist > .18) {
      const speed = petState.called ? 1.55 : .68
      const stepDist = Math.min(dist, speed * delta)
      const nx = petState.x + (dx / dist) * stepDist
      const nz = petState.z + (dz / dist) * stepDist
      petState.x = nx
      petState.z = nz
      const desiredYaw = Math.atan2(dx, dz)
      let diff = desiredYaw - petState.yaw
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      petState.yaw += diff * Math.min(1, delta * 9)
      petState.phase += delta * (petState.called ? 14 : 8)
      const swing = reducedMotion.matches ? 0 : Math.sin(petState.phase) * .48
      if (model.pet.legs.length >= 4) {
        model.pet.legs[0]!.rotation.x = swing
        model.pet.legs[1]!.rotation.x = -swing
        model.pet.legs[2]!.rotation.x = -swing
        model.pet.legs[3]!.rotation.x = swing
      }
      if (model.pet.tail) model.pet.tail.rotation.y = Math.sin(petState.phase * 1.3) * .35
      model.pet.root.position.y = baseY + (model.pet.legs.length || reducedMotion.matches ? 0 : Math.abs(Math.sin(petState.phase)) * .035)
      if (!petState.moving) { petState.moving = true; emitPetState() }
      dirty = true
    } else {
      for (const leg of model.pet.legs) leg.rotation.x = 0
      if (petState.moving || petState.called) {
        petState.moving = false
        petState.called = false
        petState.wait = 2.6 + Math.random() * 2.5
        emitPetState()
      }
      if (time < petState.happyUntil && !reducedMotion.matches) {
        model.pet.root.position.y = baseY + Math.abs(Math.sin(time * .015)) * .16
        if (model.pet.tail) model.pet.tail.rotation.y = Math.sin(time * .025) * .65
        dirty = true
      } else {
        model.pet.root.position.y = baseY
        if (model.pet.tail) model.pet.tail.rotation.y = reducedMotion.matches ? 0 : Math.sin(time * .005) * .25
        if (!reducedMotion.matches && model.pet.tail) dirty = true
      }
      petState.wait -= delta
      if (petState.wait <= 0) {
        const [tx, tz] = pickPetWaypoint(petState.floor)
        petState.targetX = tx
        petState.targetZ = tz
      }
    }
    model.pet.root.position.x = petState.x
    model.pet.root.position.z = petState.z
    model.pet.root.rotation.y = petState.yaw
  }

  function interact() {
    if (!hint || mode !== 'walk') return
    if (hint.kind === 'pet') {
      petState.happyUntil = performance.now() + 1400
      dirty = true
      return
    }
    if (hint.kind === 'door') {
      const door = model.doors.find(item => item.id === hint?.id)
      if (!door) return
      const open = openDoors.has(door.id)
      if (blocksWalk(player.position.x, player.position.z, open ? door.closed : door.open)) return
      if (open) openDoors.delete(door.id)
      else openDoors.add(door.id)
    } else if (switchedOff.has(hint.id)) switchedOff.delete(hint.id)
    else switchedOff.add(hint.id)
    updateHint()
    refreshScene()
  }
  function onKeyDown(event: KeyboardEvent) {
    if (mode !== 'walk' || event.altKey || event.ctrlKey || event.metaKey) return
    const direction = moveKeys.get(event.code)
    if (direction) {
      event.preventDefault()
      held.set(event.code, direction)
    } else if (event.code === 'KeyE' && !event.repeat) interact()
    else if (event.code === 'KeyQ' || event.code === 'KeyR') {
      targetYaw += event.code === 'KeyQ' ? .12 : -.12
    }
  }
  const onKeyUp = (event: KeyboardEvent) => { held.delete(event.code) }
  function clearKeys() {
    held.clear()
    walkVelocity.set(0, 0, 0)
    targetYaw = yaw
    targetPitch = pitch
  }
  const invalidate = () => { dirty = true }
  function rotate(dx: number, dy: number) {
    targetYaw -= dx * lookSensitivity
    targetPitch = MathUtils.clamp(targetPitch - dy * lookSensitivity, -1.24, 1.24)
  }
  async function lockLook() {
    if (mode !== 'walk' || pointerLocked || !canvas.requestPointerLock) return
    canvas.focus({ preventScroll: true })
    try { await canvas.requestPointerLock() }
    catch { /* Drag-to-look stays available if the browser rejects pointer lock. */ }
  }
  function releaseLook() {
    if (document.pointerLockElement === canvas) document.exitPointerLock()
  }
  function onLockChange() {
    const wasLocked = pointerLocked
    pointerLocked = document.pointerLockElement === canvas
    if (pointerLocked && mode !== 'walk') {
      releaseLook()
      return
    }
    if (wasLocked && !pointerLocked) clearKeys()
    pointer = undefined
    options.onLock(pointerLocked)
  }
  function onMouseMove(event: MouseEvent) {
    if (pointerLocked && mode === 'walk') rotate(event.movementX, event.movementY)
  }
  function onPointerDown(event: PointerEvent) {
    if (mode !== 'walk' || pointerLocked || !event.isPrimary || event.button !== 0) return
    canvas.focus({ preventScroll: true })
    canvas.setPointerCapture(event.pointerId)
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
  }
  function onPointerMove(event: PointerEvent) {
    if (!pointer || pointer.id !== event.pointerId || mode !== 'walk') return
    rotate(event.clientX - pointer.x, event.clientY - pointer.y)
    pointer.x = event.clientX
    pointer.y = event.clientY
  }
  function onPointerEnd(event: PointerEvent) {
    if (event.pointerId === pointer?.id) pointer = undefined
  }

  canvas.addEventListener('keydown', onKeyDown)
  canvas.addEventListener('keyup', onKeyUp)
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('lostpointercapture', onPointerEnd)
  canvas.addEventListener('blur', clearKeys)
  document.addEventListener('pointerlockchange', onLockChange)
  document.addEventListener('mousemove', onMouseMove)
  window.addEventListener('blur', clearKeys)
  orbit.addEventListener('change', invalidate)
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)

  let last = 0
  renderer.setAnimationLoop((time) => {
    const delta = Math.min(last ? (time - last) / 1000 : 0, .16)
    last = time
    if (mode === 'walk') animateWalk(delta, time)
    updatePet(delta, time)
    for (const door of model.doors) {
      const targetAngle = openDoors.has(door.id) ? Math.PI / 2 : 0
      if (Math.abs(targetAngle - door.hinge.rotation.y) > .001) {
        door.hinge.rotation.y = reducedMotion.matches ? targetAngle : MathUtils.damp(door.hinge.rotation.y, targetAngle, 16, delta)
        if (Math.abs(targetAngle - door.hinge.rotation.y) < .08) updateHint()
        if (Math.abs(targetAngle - door.hinge.rotation.y) < .02) renderer.shadowMap.needsUpdate = true
        dirty = true
      }
    }
    if (dirty) { renderer.render(scene, mode === 'walk' ? player : overview); dirty = false }
  })

  orbit.enabled = false
  enter(porch)
  resetOrbit()
  resize()
  return {
    enter, setView, interact, resetOrbit, lockLook, releaseLook, callPet,
    setLookSensitivity(multiplier: number) { lookSensitivity = baseLookSensitivity * multiplier },
    setLamps(value: boolean) { lampsOn = value; updateHint(); refreshScene() },
    setEvening(value: boolean) { evening = value; refreshScene() },
    async exportModel() {
      const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js')
      // Export all groups, regardless of the current cutaway or floor filter.
      const copy = model.house.clone(true)
      const batches: Object3D[] = []
      copy.traverse(object => {
        if (object.userData.renderBatch) batches.push(object)
        else object.visible = true
      })
      for (const batch of batches) batch.removeFromParent()
      for (const door of model.doors) {
        const hinge = copy.getObjectByName(door.hinge.name)
        if (hinge) hinge.rotation.y = 0
      }
      return await new GLTFExporter().parseAsync(copy, { binary: true }) as ArrayBuffer
    },
    dispose() {
      renderer.setAnimationLoop(null)
      releaseLook()
      observer.disconnect()
      orbit.dispose()
      canvas.removeEventListener('keydown', onKeyDown)
      canvas.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('lostpointercapture', onPointerEnd)
      canvas.removeEventListener('blur', clearKeys)
      document.removeEventListener('pointerlockchange', onLockChange)
      document.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('blur', clearKeys)
      disposeTrees(source, model.house, ...extraRoots)
      environmentMap.dispose()
      renderer.dispose()
    },
  }
}
