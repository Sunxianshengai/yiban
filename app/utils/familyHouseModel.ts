import {
  Box3, BoxGeometry, CanvasTexture, Color, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  PlaneGeometry, PointLight, RepeatWrapping, SphereGeometry, SRGBColorSpace, type BufferGeometry, type Object3D,
} from 'three'
import { floorRise, houseLevels, stairs, type Bounds2D } from './familyHouseLayout'

export interface HouseDoor {
  id: string; label: string; floor: number; hinge: Group; x: number; z: number
  closed: Bounds2D; open: Bounds2D
}

export interface HousePetRig {
  root: Group
  legs: Group[]
  tail: Group | null
  head: Group | null
}

function makeCanvasTexture(size: number, repeatX: number, repeatY: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  draw(ctx, size)
  const tex = new CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.repeat.set(repeatX, repeatY)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function makeContactShadowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30)
  grad.addColorStop(0, 'rgba(38, 34, 28, 0.42)')
  grad.addColorStop(0.6, 'rgba(38, 34, 28, 0.16)')
  grad.addColorStop(1, 'rgba(38, 34, 28, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 64)
  return new CanvasTexture(canvas)
}

export function buildFamilyHouse(source: Object3D, extras: Record<string, Object3D | null> = {}) {
  const house = new Group()
  house.name = 'Three-storey family home'
  const ground = new Group()
  const roof = new Group()
  const doors: HouseDoor[] = []
  const floors = houseLevels.map((_, index) => {
    const root = new Group()
    root.name = `Storey ${index + 1}`
    root.position.y = index * floorRise
    const front = new Group()
    front.name = `Storey ${index + 1} facade`
    root.add(front)
    house.add(root)
    return { root, front, solids: [] as Bounds2D[], lights: [] as PointLight[] }
  })
  house.add(ground, roof)
  ground.name = 'Entrance garden'
  roof.name = 'Flat roof and parapet'

  type MaterialKind = 'matte' | 'plaster' | 'oak' | 'fabric' | 'ceramic' | 'metal' | 'curtain' | 'lamp' | 'screen'
  const oakTex = makeCanvasTexture(128, 3, 2, (ctx, s) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, s, s)
    ctx.strokeStyle = 'rgba(130, 95, 55, 0.14)'
    ctx.lineWidth = 1.5
    for (let y = 0; y < s; y += 16) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(s, y)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(120, 88, 52, 0.08)'
    for (let i = 0; i < 24; i++) {
      const y = (i * 19) % s
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.bezierCurveTo(s * 0.35, y + 3, s * 0.7, y - 3, s, y)
      ctx.stroke()
    }
  })
  const plasterTex = makeCanvasTexture(128, 4, 4, (ctx, s) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, s, s)
    for (let i = 0; i < 260; i++) {
      const x = (i * 53) % s
      const y = (i * 97) % s
      ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.04)'
      ctx.fillRect(x, y, 2, 2)
    }
  })
  const fabricTex = makeCanvasTexture(64, 6, 6, (ctx, s) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, s, s)
    ctx.fillStyle = 'rgba(0,0,0,0.045)'
    for (let y = 0; y < s; y += 4) ctx.fillRect(0, y, s, 1)
    for (let x = 0; x < s; x += 4) ctx.fillRect(x, 0, 1, s)
  })
  const contactShadowTex = makeContactShadowTexture()
  const contactShadowMat = new MeshBasicMaterial({
    map: contactShadowTex, transparent: true, depthWrite: false, opacity: .68,
  })
  const emissiveMaterials: MeshStandardMaterial[] = []
  const materials = new Map<string, MeshStandardMaterial>()
  const material = (color: string, kind: MaterialKind = 'matte') => {
    const key = `${kind}:${color}`
    let found = materials.get(key)
    if (!found) {
      if (kind === 'oak') found = new MeshStandardMaterial({ color, map: oakTex, roughness: .44 })
      else if (kind === 'plaster') found = new MeshStandardMaterial({ color, map: plasterTex, roughness: .88 })
      else if (kind === 'fabric') found = new MeshStandardMaterial({ color, map: fabricTex, roughness: .93 })
      else if (kind === 'ceramic') found = new MeshStandardMaterial({ color, roughness: .16, metalness: .04 })
      else if (kind === 'metal') found = new MeshStandardMaterial({ color, roughness: .26, metalness: .78 })
      else if (kind === 'curtain') found = new MeshStandardMaterial({ color, roughness: .85, transparent: true, opacity: .74, depthWrite: false })
      else if (kind === 'lamp') {
        found = new MeshStandardMaterial({ color, emissive: '#ffd7a3', emissiveIntensity: 1.25, roughness: .42 })
        emissiveMaterials.push(found)
      } else if (kind === 'screen') {
        found = new MeshStandardMaterial({ color, emissive: '#9dc4d8', emissiveIntensity: .55, roughness: .22 })
        emissiveMaterials.push(found)
      } else found = new MeshStandardMaterial({ color, roughness: .79 })
      materials.set(key, found)
    }
    return found
  }
  const geoCache = new Map<string, BufferGeometry>()
  const boxGeo = (w: number, h: number, d: number) => {
    const key = `b:${w.toFixed(4)},${h.toFixed(4)},${d.toFixed(4)}`
    let g = geoCache.get(key)
    if (!g) { g = new BoxGeometry(w, h, d); geoCache.set(key, g) }
    return g
  }
  const cylGeo = (rt: number, rb: number, h: number, seg = 12) => {
    const key = `c:${rt.toFixed(4)},${rb.toFixed(4)},${h.toFixed(4)},${seg}`
    let g = geoCache.get(key)
    if (!g) { g = new CylinderGeometry(rt, rb, h, seg); geoCache.set(key, g) }
    return g
  }
  const sphGeo = (r: number, w = 12, h = 8) => {
    const key = `s:${r.toFixed(4)},${w},${h}`
    let g = geoCache.get(key)
    if (!g) { g = new SphereGeometry(r, w, h); geoCache.set(key, g) }
    return g
  }
  function mesh(parent: Group, name: string, geometry: BufferGeometry,
    p: [number, number, number], color: string, kind: MaterialKind = 'matte') {
    const object = new Mesh(geometry, material(color, kind))
    object.name = name
    object.position.set(...p)
    parent.add(object)
    return object
  }
  const box = (parent: Group, name: string, p: [number, number, number], size: [number, number, number],
    color: string, kind: MaterialKind = 'matte') =>
    mesh(parent, name, boxGeo(...size), p, color, kind)
  function contactShadow(parent: Group, x: number, z: number, w: number, d: number, y = .006) {
    const shadow = new Mesh(new PlaneGeometry(w, d), contactShadowMat)
    shadow.name = 'Contact shadow'
    shadow.rotation.x = -Math.PI / 2
    shadow.position.set(x, y, z)
    parent.add(shadow)
    return shadow
  }
  const plaster = '#eeeae0'
  const frame = '#57635e'
  const oak = '#c5a276'
  const green = '#a9b6a3'
  const blue = '#91afbd'
  const clay = '#cc917a'
  const tile = '#dbdfd8'
  const cream = '#f0e2c9'
  const glass = new MeshStandardMaterial({ color: '#b9d1d4', roughness: .17, transparent: true, opacity: .27, depthWrite: false })
  function footprint(floor: number, x: number, z: number, w: number, d: number) {
    floors[floor]!.solids.push({ left: x - w / 2, right: x + w / 2, back: z - d / 2, front: z + d / 2 })
  }

  // Use exact nodes from the chosen reference so upholstery and details survive assembly.
  const templates = new Map<number, Object3D>()
  source.traverse(object => {
    const match = /^(\d{3})-[\w-]+$/.exec(object.name)
    if (match && object.children.length) templates.set(Number(match[1]), object)
  })
  function furniture(floor: number, id: number, x: number, z: number, options: { y?: number; angle?: number; scale?: number; solid?: boolean } = {}) {
    const template = templates.get(id)
    if (!template) throw new Error(`Furniture ${id} is missing from the reference GLB`)
    const object = template.clone(true)
    object.position.set(x, options.y ?? 0, z)
    object.rotation.y += options.angle ?? 0
    object.scale.multiplyScalar(options.scale ?? 1)
    floors[floor]!.root.add(object)
    if (options.solid) {
      const { min, max } = new Box3().setFromObject(object)
      floors[floor]!.solids.push({ left: min.x, right: max.x, back: min.z, front: max.z })
    }
    return object
  }
  function placeExtra(parent: Group, key: string, x: number, z: number,
    options: { y?: number; angle?: number; scale?: number; floorForSolid?: number } = {}) {
    const template = extras[key]
    if (!template) return null
    const object = template.clone(true)
    const scale = options.scale ?? 1
    object.scale.multiplyScalar(scale)
    object.rotation.y += options.angle ?? 0
    // Place bottom of bounding box cleanly at options.y ?? 0
    object.updateMatrixWorld(true)
    const box3 = new Box3().setFromObject(object)
    const offsetY = (options.y ?? 0) - box3.min.y
    const centerX = (box3.min.x + box3.max.x) / 2
    const centerZ = (box3.min.z + box3.max.z) / 2
    object.position.set(x - centerX, offsetY, z - centerZ)
    parent.add(object)
    if (options.floorForSolid !== undefined) {
      object.updateMatrixWorld(true)
      const { min, max } = new Box3().setFromObject(object)
      floors[options.floorForSolid]!.solids.push({ left: min.x, right: max.x, back: min.z, front: max.z })
    }
    return object
  }
  function plant(parent: Group, x: number, z: number, scale = 1, y = 0) {
    const key = scale >= 1.05 ? 'tall-plant' : 'small-plant'
    if (placeExtra(parent, key, x, z, { y, scale: scale >= 1.05 ? scale * 0.85 : scale * 0.95 })) return
    const pot = mesh(parent, 'Terracotta pot', cylGeo(.18, .13, .28, 12), [x, y + .14 * scale, z], clay)
    pot.scale.setScalar(scale)
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3
      const leaf = mesh(parent, 'Plant leaf', sphGeo(1, 9, 5),
        [x + Math.cos(angle) * .14 * scale, y + (.36 + .047 * i) * scale, z + Math.sin(angle) * .14 * scale],
        i % 2 ? '#718d67' : '#88a47b')
      leaf.scale.set(.085 * scale, .22 * scale, .046 * scale)
      leaf.rotation.set(.55, angle, .22)
    }
  }
  function warm(floor: number, name: string, x: number, y: number, z: number, intensity: number) {
    const lamp = new PointLight('#ffd6ad', intensity, 5.7, 2)
    lamp.name = name
    lamp.position.set(x, y, z)
    floors[floor]!.lights.push(lamp)
    floors[floor]!.root.add(lamp)
    return lamp
  }
  function picture(parent: Group, x: number, y: number, z: number, accent: string, width = .47) {
    box(parent, 'Oak picture frame', [x, y, z], [width, .49, .033], oak, 'oak')
    box(parent, 'Artwork paper', [x, y, z + .021], [width - .048, .438, .010], '#faf0dd', 'matte')
    const shape = mesh(parent, 'Artwork color patch', sphGeo(1, 14, 7), [x - .053, y + .035, z + .028], accent, 'matte')
    shape.scale.set(.106, .123, .004)
    box(parent, 'Artwork color patch', [x + .057, y - .083, z + .031], [.16, .072, .006], green, 'matte').rotateZ(.19)
  }
  function cups(parent: Group, x: number, y: number, z: number) {
    for (const [i, color] of [blue, clay].entries()) {
      mesh(parent, 'Stoneware cup', cylGeo(.055, .046, .084, 13), [x + .19 * i, y + .042, z], color, 'ceramic')
      mesh(parent, 'Stoneware cup inset', cylGeo(.04, .04, .006, 13), [x + .19 * i, y + .086, z], '#92725c', 'matte')
    }
  }
  function curtains(parent: Group, x: number, z: number, width: number, offsetZ: number) {
    box(parent, 'Curtain rod', [x, 2.34, z + offsetZ], [width + .34, .024, .024], frame, 'metal')
    for (const side of [-1, 1]) {
      box(parent, 'Linen curtain', [x + side * (width / 2 - .07), 1.56, z + offsetZ], [.24, 1.52, .045], '#f3ede0', 'curtain')
    }
  }
  function wallClock(parent: Group, x: number, y: number, z: number) {
    const rim = mesh(parent, 'Wall clock rim', cylGeo(.20, .20, .032, 20), [x, y, z], oak, 'oak')
    rim.rotation.x = Math.PI / 2
    const face = mesh(parent, 'Wall clock face', cylGeo(.175, .175, .036, 20), [x, y, z + .002], '#fbf8f1', 'matte')
    face.rotation.x = Math.PI / 2
    box(parent, 'Clock hand', [x, y + .04, z + .024], [.012, .09, .008], frame, 'metal')
    box(parent, 'Clock hand', [x + .04, y, z + .024], [.08, .010, .008], clay, 'metal')
  }
  function alongX(parent: Group, name: string, left: number, right: number, z: number, windows: [number, number][], withCurtains = false) {
    let cursor = left
    for (const [x, width] of windows) {
      const start = x - width / 2
      box(parent, 'Wall', [(cursor + start) / 2, 1.35, z], [start - cursor, 2.7, .17], plaster, 'plaster')
      box(parent, 'Window sill wall', [x, .42, z], [width, .84, .17], plaster, 'plaster')
      box(parent, 'Window header', [x, 2.49, z], [width, .42, .17], plaster, 'plaster')
      for (const side of [-1, 1]) {
        box(parent, 'Window jamb', [x + side * (width / 2 - .025), 1.56, z], [.05, 1.44, .115], frame, 'metal')
        box(parent, 'Window rail', [x, 1.56 + side * .696, z], [width, .051, .115], frame, 'metal')
      }
      box(parent, 'Window mullion', [x, 1.56, z], [.035, 1.4, .105], frame, 'metal')
      const pane = box(parent, 'Window pane', [x, 1.56, z], [width - .07, 1.37, .022], '#b9d1d4')
      pane.material = glass
      box(parent, 'Wood window ledge', [x, .83, z + Math.sign(-z) * .045], [width + .13, .045, .27], oak, 'oak')
      if (withCurtains && width > 1.3) curtains(parent, x, z, width, Math.sign(-z) * .11 || .11)
      cursor = x + width / 2
    }
    box(parent, name, [(cursor + right) / 2, 1.35, z], [right - cursor, 2.7, .17], plaster, 'plaster')
  }
  function plankFloor(parent: Group, x: number, z: number, w: number, d: number) {
    box(parent, 'Oak floor slab', [x, -.078, z], [w, .156, d], '#bd9a70', 'oak')
    const rows = Math.ceil(d / .34)
    for (let i = 0; i < rows; i++) {
      const depth = d / rows
      box(parent, 'Oak floor board', [x, -.004, z - d / 2 + depth * (i + .5)], [w - .005, .01, depth - .004],
        ['#d7b992', '#d2b28a', '#d9bd99', '#dbbf99', '#d8b891'][i % 5]!, 'oak')
    }
  }

  for (const [index, floor] of floors.entries()) {
    const isTerrace = index === 3
    plankFloor(floor.root, (stairs.left - 5.4) / 2, 0, stairs.left + 5.4, 6.6)
    const stairWidth = 5.4 - stairs.left
    const stairCenter = stairs.left + stairWidth / 2
    if (index === 0) plankFloor(floor.root, stairCenter, 0, stairWidth, 6.6)
    else {
      plankFloor(floor.root, stairCenter, (-3.3 + stairs.back) / 2, stairWidth, stairs.back + 3.3)
      plankFloor(floor.root, stairCenter, (3.3 + stairs.front) / 2, stairWidth, 3.3 - stairs.front)
    }
    if (isTerrace) {
      // 屋顶露台：四周 1.05m 女儿墙 + 木扶手，留出开阔天空视野
      for (const sign of [-1, 1]) {
        const target = sign > 0 ? floor.front : floor.root
        box(target, 'Terrace parapet', [0, .52, sign * 3.27], [10.8, 1.04, .18], plaster, 'plaster')
        box(target, 'Terrace coping', [0, 1.06, sign * 3.27], [10.86, .06, .24], oak, 'oak')
        box(floor.root, 'Terrace side parapet', [sign * 5.31, .52, 0], [.18, 1.04, 6.42], plaster, 'plaster')
        box(floor.root, 'Terrace side coping', [sign * 5.31, 1.06, 0], [.24, .06, 6.50], oak, 'oak')
      }
    } else {
      alongX(floor.root, 'North wall', -5.4, 5.4, -3.27, [[-3.3, 2.48], [1.35, 2.38], [4.64, .82]], true)
      const start = index === 0 ? 1.83 : 5.4
      alongX(floor.front, 'Front wall', -5.4, start, 3.27, [[-3.18, 2.45], [.55, 1.97]], true)
      // 踢脚线收口
      box(floor.root, 'North baseboard', [0, .045, -3.175], [10.48, .09, .022], oak, 'oak')
      box(floor.front, 'Front baseboard', [-1.78, .045, 3.175], [6.9, .09, .022], oak, 'oak')
      if (index === 0) {
        box(floor.front, 'Entrance door surround', [2.47, 2.54, 3.27], [1.29, .32, .18], plaster, 'plaster')
        const hinge = new Group()
        hinge.name = 'Entrance door hinge'
        hinge.position.set(1.86, 0, 3.27)
        floor.front.add(hinge)
        box(hinge, 'Oak entrance door', [.61, 1.107, 0], [1.22, 2.21, .081], '#ad805b', 'oak')
        box(hinge, 'Inset upper panel', [.61, 1.57, .046], [.92, .75, .012], '#b99573', 'oak')
        box(hinge, 'Inset lower panel', [.61, .55, .046], [.92, .85, .012], '#b99573', 'oak')
        box(hinge, 'Entrance door handle', [1.07, 1.02, .065], [.034, .23, .060], frame, 'metal')
        doors.push({ id: 'entrance', label: '入户门', floor: 0, hinge, x: 2.47, z: 3.27,
          closed: { left: 1.84, right: 3.10, back: 3.22, front: 3.32 },
          open: { left: 1.82, right: 1.91, back: 2.025, front: 3.31 } })
        box(floor.front, 'Entrance stair wall', [4.25, 1.35, 3.27], [2.30, 2.7, .17], plaster, 'plaster')
      }
      for (const side of [-1, 1]) {
        const x = side * 5.32
        const sideWall = new Group()
        sideWall.position.x = x
        sideWall.rotation.y = Math.PI / 2
        floor.root.add(sideWall)
        alongX(sideWall, 'Side wall', -3.27, 3.27, 0, [[-.9, 1.38], [1.62, 1.13]])
        box(floor.root, 'Side baseboard', [x - side * .09, .045, 0], [.022, .09, 6.36], oak, 'oak')
      }
    }
    const rail = new Group()
    rail.name = 'Stair guard'
    floor.root.add(rail)
    const railLength = stairs.front - stairs.back
    for (let i = 0; i < 13; i++) box(rail, 'Oak stair baluster', [stairs.left, .46, stairs.back + railLength * i / 12], [.055, .92, .055], oak, 'oak')
    box(rail, 'Oak stair handrail', [stairs.left, .94, (stairs.back + stairs.front) / 2], [.075, .075, railLength], oak, 'oak')
    if (index > 0) box(floor.root, 'Stairwell back guard', [stairCenter, .47, stairs.back], [stairWidth, .94, .07], '#c3a581', 'oak')
    box(floor.root, 'Front floor edge', [0, -.097, 3.31], [10.88, .20, .12], plaster, 'plaster')
    if (index < 3) {
      const count = 9
      const run = stairs.front - stairs.turn
      const rise = floorRise / 2
      for (const side of [-1, 1]) {
        const x = stairs.middle + side * .56
        for (let i = 0; i < count; i++) {
          const y = side < 0 ? (i + 1) * rise / count : floorRise - i * rise / count
          const z = stairs.front - (i + .5) * run / count
          box(floor.root, 'Oak stair tread', [x, y - .08, z], [stairs.laneWidth, .16, run / count + .009], oak, 'oak')
          if (i % 3 === 0) box(floor.root, 'Stair rail post', [x - side * .505, y + .44, z], [.05, .91, .05], oak, 'oak')
        }
        const support = box(floor.root, 'Oak stair stringer', [x, (side < 0 ? .66 : 2.1) - .08, (stairs.front + stairs.turn) / 2],
          [.13, .21, Math.hypot(rise, run)], '#b48e66', 'oak')
        support.rotation.x = -side * Math.atan2(rise, run)
        const handrail = box(floor.root, 'Flight handrail', [stairs.middle + side * .055, side < 0 ? 1.65 : 3.08, (stairs.front + stairs.turn) / 2],
          [.07, .065, Math.hypot(rise, run)], oak, 'oak')
        handrail.rotation.x = -side * Math.atan2(rise, run)
      }
      box(floor.root, 'Half landing', [stairCenter - .045, rise - .10, (stairs.back + stairs.turn) / 2],
        [stairWidth - .09, .20, stairs.turn - stairs.back + .018], oak, 'oak')
      box(floor.root, 'Half landing guard', [stairCenter - .045, rise + .46, stairs.back + .03], [stairWidth - .09, .92, .06], oak, 'oak')
    }
  }

  // 露台木质凉亭框架（仅全屋/外观模式作为屋顶轮廓展示）
  for (const x of [-4.6, -1.8]) {
    box(roof, 'Pergola post', [x, 9.65, -2.6], [.11, 2.5, .11], oak, 'oak')
    box(roof, 'Pergola post', [x, 9.65, .2], [.11, 2.5, .11], oak, 'oak')
  }
  for (let i = 0; i < 5; i++) {
    box(roof, 'Pergola beam', [-3.2, 10.92, -2.5 + i * .68], [3.2, .08, .09], oak, 'oak')
  }
  box(ground, 'Garden base', [0, -.27, .43], [38, .21, 28], '#cbd0b8')
  box(ground, 'Garden path', [2.47, -.154, 4.45], [1.59, .028, 2.3], '#c8bfb0')
  // 通往一层周边邻居家小屋的社区石板步道
  box(ground, 'Neighborhood walkway', [0, -.158, 5.75], [26.5, .024, 1.35], '#c9c0b1')
  box(ground, 'West cottage path', [-10.5, -.158, 2.6], [1.3, .024, 6.2], '#c9c0b1')
  box(ground, 'East cottage path', [10.8, -.158, 2.6], [1.3, .024, 6.2], '#c9c0b1')
  // 一层周边多个开源完整 3D 小屋模型（庭院聚落）
  placeExtra(ground, 'house-cozy', -11.5, -1.6, { y: -.16, angle: Math.PI / 2, scale: .88 })
  placeExtra(ground, 'house-coastal', 11.4, -1.5, { y: -.16, angle: -Math.PI / 2, scale: .92 })
  placeExtra(ground, 'house-cottage', -9.8, 10.2, { y: -.16, angle: .28, scale: 1.05 })
  placeExtra(ground, 'house-coastal', 10.2, 10.4, { y: -.16, angle: -.36, scale: .88 })
  box(ground, 'Doorstep', [2.47, -.068, 3.54], [1.63, .156, .55], '#bcb2a1')
  box(ground, 'Coconut coir doormat', [2.47, .015, 3.55], [.78, .022, .36], '#83694b', 'fabric')
  for (let stripe = 0; stripe < 5; stripe++)
    box(ground, 'Doormat weave', [2.47, .027, 3.41 + .068 * stripe], [.69, .004, .018], '#a98e68', 'fabric')
  box(ground, 'Oak door canopy', [2.47, 2.48, 3.51], [1.64, .12, .69], '#b69779', 'oak')
  box(ground, 'Porch light', [3.18, 2.13, 3.38], [.10, .24, .13], '#ffefcf', 'lamp')
  for (const x of [-4.25, -2.78, 1.02]) plant(ground, x, 3.84, 1.10)

  const living = floors[0]!.root
  furniture(0, 24, -2.90, -2.31, { solid: true })
  furniture(0, 25, -2.95, -.85, { scale: 1.21 })
  furniture(0, 26, -2.95, -.64, { solid: true })
  furniture(0, 27, -4.26, -.8, { scale: .80, angle: 1.12, solid: true })
  furniture(0, 30, -4.64, -2.47, { scale: .87 })
  furniture(0, 34, .89, .73, { solid: true })
  furniture(0, 35, .24, -.03, { solid: true })
  furniture(0, 36, 1.49, -.03, { solid: true })
  furniture(0, 38, .86, 1.5, { solid: true })
  furniture(0, 39, .93, .73, { y: 1.43 })
  furniture(0, 32, 1.32, 2.87, { angle: Math.PI / 2, scale: .72, solid: true })
  // 一楼细节：地毯、抱枕、时钟、玄关托盘、接触阴影、厨房小家电
  box(living, 'Living woven rug', [-2.95, .008, -.78], [2.7, .012, 2.15], '#dfd6c5', 'fabric')
  box(living, 'Sofa pillow', [-3.45, .56, -2.26], [.34, .30, .14], clay, 'fabric').rotateZ(.14)
  box(living, 'Sofa pillow', [-2.35, .56, -2.26], [.34, .30, .14], blue, 'fabric').rotateZ(-.12)
  wallClock(living, .89, 1.95, -3.165)
  box(living, 'Entrance tray', [1.32, .81, 2.86], [.28, .022, .18], oak, 'oak')
  box(living, 'Cutting board', [.96, .96, -2.76], [.34, .018, .24], oak, 'oak')
  box(living, 'Kettle', [2.25, 1.04, -2.84], [.16, .18, .16], '#e6e2d8', 'ceramic')
  box(living, 'Spice jar', [1.26, .99, -2.95], [.06, .10, .06], clay, 'ceramic')
  box(living, 'Spice jar', [1.35, .99, -2.95], [.06, .10, .06], green, 'ceramic')
  contactShadow(living, -2.95, -.64, 1.55, .95)
  contactShadow(living, .89, .73, 1.85, 1.35)
  placeExtra(living, 'pet-bed', -1.85, .55, { scale: .92 })
  placeExtra(living, 'pet-bowls', -1.25, .62, { scale: .85 })
  placeExtra(living, 'tv-unit', -2.95, 2.86, { angle: Math.PI, floorForSolid: 0 })
  placeExtra(living, 'floor-lamp', -4.72, -2.55, { floorForSolid: 0 })
  placeExtra(living, 'sideboard', 2.48, .75, { angle: -Math.PI / 2, floorForSolid: 0 })
  placeExtra(living, 'cat-tree', -4.65, 1.55, { floorForSolid: 0 })
  placeExtra(living, 'shoe-rack', 1.92, 2.95, { angle: Math.PI, floorForSolid: 0 })
  placeExtra(living, 'coffee-maker', .02, -2.84, { y: .95 })
  placeExtra(living, 'microwave', 2.28, -2.84, { y: .95 })
  plant(living, -4.76, 2.42, 1.26)
  plant(living, -1.10, -2.85, .86)
  box(living, 'Kitchen counter', [1.05, .91, -2.8], [3.36, .075, .69], '#f0ebe0', 'ceramic')
  for (let i = 0; i < 5; i++) {
    const x = -.26 + .655 * i
    box(living, 'Sage kitchen cabinet', [x, .45, -2.81], [.64, .88, .60], green, 'matte')
    box(living, 'Cabinet pull', [x, .74, -2.486], [.19, .024, .043], frame, 'metal')
  }
  footprint(0, 1.05, -2.8, 3.36, .69)
  box(living, 'Sink insert', [.39, .952, -2.82], [.50, .012, .36], '#9da5a4', 'metal')
  box(living, 'Kitchen tap', [.39, 1.075, -3.00], [.043, .245, .04], frame, 'metal')
  box(living, 'Cooktop', [1.71, .954, -2.82], [.55, .014, .42], '#555a56', 'metal')
  for (const x of [1.58, 1.84]) for (const z of [-2.92, -2.70])
    mesh(living, 'Hob ring', new CylinderGeometry(.077, .077, .012, 16), [x, .967, z], '#929290')
  box(living, 'Cream fridge', [2.92, .91, -2.82], [.58, 1.82, .60], cream)
  box(living, 'Fridge handle', [2.72, 1.05, -2.491], [.028, .29, .054], frame)
  footprint(0, 2.92, -2.82, .6, .64)
  box(living, 'Linen table runner', [.89, .831, .73], [1.46, .004, .29], '#e7dbc6', 'fabric')
  cups(living, .36, .837, .81)
  box(living, 'Book on coffee table', [-3.09, .486, -.62], [.24, .035, .19], clay, 'matte').rotateY(.14)
  picture(living, -1.66, 1.71, -3.164, clay, .43)
  picture(living, -.99, 1.84, -3.164, blue, .51)
  // 复刻视频 0:02 客厅细节：墙面原木长隔板 + 绿植 + 矮柜彩色竖放书列 + 窗边粉色小椅
  box(living, 'Wall oak shelf', [-1.35, 1.98, -3.04], [1.18, .035, .24], oak, 'oak')
  box(living, 'Shelf book row', [-1.65, 2.11, -3.04], [.05, .22, .16], '#2e3136', 'matte')
  box(living, 'Shelf book row', [-1.59, 2.10, -3.04], [.045, .20, .16], '#c8534b', 'matte')
  box(living, 'Shelf book row', [-1.53, 2.12, -3.04], [.048, .23, .16], '#ebe6da', 'matte')
  box(living, 'Shelf book row', [-1.47, 2.09, -3.04], [.045, .19, .16], '#5ea0a7', 'matte')
  mesh(living, 'Shelf pot', cylGeo(.065, .05, .11, 12), [-1.02, 2.05, -3.04], '#eae5da', 'ceramic')
  mesh(living, 'Shelf plant', sphGeo(.09, 10, 8), [-1.02, 2.15, -3.04], '#6f9162', 'matte')
  // 窗边粉色小椅子
  box(living, 'Pink chair seat', [-3.18, .44, 2.42], [.44, .06, .42], '#e8b3b8', 'fabric')
  box(living, 'Pink chair back', [-3.18, .69, 2.60], [.42, .44, .06], '#e8b3b8', 'fabric')
  for (const lx of [-3.35, -3.01]) for (const lz of [2.25, 2.58]) {
    box(living, 'Pink chair leg', [lx, .21, lz], [.035, .42, .035], oak, 'oak')
  }
  footprint(0, -3.18, 2.42, .48, .46)
  // 一楼自发光灯具（餐桌吊灯罩 + 客厅吸顶灯）
  mesh(living, 'Dining pendant shade', cylGeo(.22, .30, .16, 16), [.93, 2.02, .73], '#fff2d8', 'lamp')
  mesh(living, 'Living ceiling fixture', cylGeo(.22, .22, .05, 16), [-3.24, 2.55, -1.51], '#fff2d8', 'lamp')
  warm(0, 'Dining pendant glow', .93, 1.97, .73, 11)
  warm(0, 'Sofa corner warm light', -3.24, 2.42, -1.51, 13)
  warm(0, 'Kitchen warm light', 1.12, 2.39, -2.28, 11)

  const sleeping = floors[1]!.root
  const bedroomDoor = furniture(1, 8, -.67, 0)
  const leaves = bedroomDoor.children.filter(child => child.name.includes('door-leaf'))
  if (leaves.length !== 2) throw new Error('Bedroom door is missing its leaf or handle')
  const door = new Group()
  door.name = 'Bedroom door hinge'
  door.position.set(-.668, 0, .444)
  sleeping.add(door)
  for (const leaf of leaves) door.attach(leaf)
  for (const z of [-2.63, 2.63]) box(sleeping, 'Bedroom partition', [-.67, 1.35, z], [.16, 2.70, 1.28], plaster, 'plaster')
  for (const z of [-1.87, 1.87]) footprint(1, -.67, z, .16, 2.84)
  const closedDoor = { left: -.711, right: -.625, front: .45, back: -.45 }
  const openDoor = { left: -1.58, right: -.64, front: .49, back: .40 }
  doors.push({ id: 'bedroom', label: '卧室门', floor: 1, hinge: door, x: -.67, z: 0, closed: closedDoor, open: openDoor })

  // 二楼浴室门（可按 E 开关）
  const bathHinge = new Group()
  bathHinge.name = 'Bathroom door hinge'
  bathHinge.position.set(2.16, 0, -.86)
  sleeping.add(bathHinge)
  box(bathHinge, 'Bathroom door leaf', [.415, 1.06, 0], [.83, 2.12, .055], '#e9e4d8', 'oak')
  box(bathHinge, 'Bathroom frosted glass', [.415, 1.36, 0], [.52, .84, .062], '#d6e3e2', 'curtain')
  box(bathHinge, 'Bathroom door handle', [.74, 1.02, .042], [.025, .14, .045], frame, 'metal')
  doors.push({
    id: 'bath-door', label: '浴室门', floor: 1, hinge: bathHinge, x: 2.58, z: -.86,
    closed: { left: 2.15, right: 2.99, back: -.90, front: -.82 },
    open: { left: 2.12, right: 2.20, back: -1.69, front: -.84 },
  })

  furniture(1, 9, -3.22, -1.22, { solid: true })
  furniture(1, 10, -3.15, -.44)
  furniture(1, 11, -1.95, -2.23, { solid: true })
  furniture(1, 12, -1.95, -2.23, { y: .54 })
  furniture(1, 14, -3.17, -.89, { y: .71 })
  furniture(1, 17, -4.79, .03, { scale: .93, solid: true })
  furniture(1, 19, -3.29, -3.12)
  furniture(1, 21, -1.67, 2.72, { angle: Math.PI, solid: true })
  contactShadow(sleeping, -3.22, -1.22, 2.1, 2.2)
  // 复刻视频 0:19 主卧细节：清浅青蓝床垫铺面 + 通顶白色衣柜黑拉手 + 顶部吊柜
  box(sleeping, 'Teal bed mattress layer', [-3.22, .38, -1.08], [1.72, .05, 1.78], '#8cc4ca', 'fabric')
  box(sleeping, 'White bed pillow', [-3.55, .45, -1.78], [.52, .10, .34], '#f7f5f0', 'fabric')
  box(sleeping, 'White bed pillow', [-2.89, .45, -1.78], [.52, .10, .34], '#f7f5f0', 'fabric')
  for (let i = 0; i < 4; i++) {
    const cx = -3.95 + i * .54
    box(sleeping, 'Overhead cabinet', [cx, 2.28, -2.96], [.525, .64, .36], '#f3f1ec', 'plaster')
    box(sleeping, 'Cabinet handle', [cx + .18, 2.12, -2.77], [.018, .12, .018], '#2b2d30', 'metal')
  }
  box(sleeping, 'Bedroom rug', [-3.2, .008, .55], [2.1, .012, 1.5], '#dde3dc', 'fabric')
  placeExtra(sleeping, 'floor-lamp', -4.65, -2.55, { floorForSolid: 1 })
  placeExtra(sleeping, 'bookshelf', -4.85, 1.85, { angle: Math.PI / 2, floorForSolid: 1 })
  box(sleeping, 'Playroom rug', [.88, .008, 1.85], [1.75, .012, 1.65], '#ede3d1', 'fabric')
  mesh(sleeping, 'Bedside lamp shade', cylGeo(.11, .14, .16, 14), [-1.95, .88, -2.23], '#fff2d8', 'lamp')
  const bedside = warm(1, 'Bedside lamp glow', -1.95, .88, -2.23, 5.5)
  warm(1, 'Bedroom ceiling light', -3.08, 2.4, -.85, 13)

  furniture(1, 9, .48, -1.84, { scale: .71, solid: true })
  furniture(1, 14, .49, -1.63, { y: .52, scale: .63 })
  furniture(1, 25, .88, 1.9, { scale: .92 })
  furniture(1, 33, .06, 1.8, { scale: .88 })
  furniture(1, 33, 1.59, 2.5, { scale: .72 })
  furniture(1, 31, .91, 3.02, { angle: Math.PI / 2, scale: .68, solid: true })
  for (let i = 0; i < 6; i++) {
    box(sleeping, 'Wooden toy block', [.52 + (i % 3) * .14, .07 + Math.floor(i / 3) * .116, 2.04],
      [.117, .12, .12], [clay, blue, green][i % 3]!, 'matte').rotateY(i * .2)
  }
  box(sleeping, 'Bathroom floor', [2.26, .011, -2.02], [1.65, .028, 2.38], tile, 'ceramic')
  box(sleeping, 'Bathroom side partition', [1.43, 1.33, -2.05], [.12, 2.66, 2.40], plaster, 'plaster')
  box(sleeping, 'Bathroom front partition', [1.78, 1.34, -.86], [.73, 2.68, .12], plaster, 'plaster')
  box(sleeping, 'Bathroom stair partition', [3.06, 1.34, -2.02], [.10, 2.68, 2.42], plaster, 'plaster')
  footprint(1, 1.43, -2.05, .12, 2.40)
  footprint(1, 1.78, -.86, .73, .12)
  footprint(1, 3.06, -2.02, .10, 2.42)
  if (!placeExtra(sleeping, 'bathtub', 1.85, -2.42, { angle: Math.PI / 2 })) {
    box(sleeping, 'White bathtub base', [1.85, .15, -2.42], [.65, .29, 1.37], '#f3f0e8', 'ceramic')
    for (const side of [-1, 1]) {
      box(sleeping, 'White bathtub rim', [1.85 + side * .28, .40, -2.42], [.09, .23, 1.37], '#f3f0e8', 'ceramic')
      box(sleeping, 'White bathtub end', [1.85, .40, -2.42 + side * .64], [.48, .23, .09], '#f3f0e8', 'ceramic')
    }
  }
  box(sleeping, 'Bath mat', [2.42, .028, -2.20], [.44, .01, .72], '#d4ddd6', 'fabric')
  box(sleeping, 'Basin vanity', [2.65, .41, -2.87], [.55, .82, .50], oak, 'oak')
  box(sleeping, 'Ceramic basin', [2.65, .86, -2.87], [.58, .11, .51], '#f3f0e8', 'ceramic')
  box(sleeping, 'Bathroom mirror', [2.65, 1.53, -3.164], [.53, .66, .032], '#b3c6c5', 'ceramic')
  box(sleeping, 'Bath mirror light bar', [2.65, 1.90, -3.14], [.48, .04, .05], '#fff4db', 'lamp')
  box(sleeping, 'Folded towel', [2.78, .926, -2.75], [.22, .035, .19], green, 'fabric')
  mesh(sleeping, 'Toothbrush cup', cylGeo(.035, .030, .09, 12), [2.47, .955, -2.96], blue, 'ceramic')
  if (!placeExtra(sleeping, 'toilet', 1.78, -1.42, { angle: Math.PI / 2 })) {
    const toilet = mesh(sleeping, 'Porcelain toilet', sphGeo(1, 18, 10), [1.78, .30, -1.42], '#faf7ef', 'ceramic')
    toilet.scale.set(.23, .195, .28)
    box(sleeping, 'Toilet cistern', [1.64, .58, -1.42], [.19, .32, .40], '#faf7ef', 'ceramic')
  }
  footprint(1, 1.78, -1.42, .46, .56)
  footprint(1, 1.85, -2.42, .65, 1.37)
  footprint(1, 2.65, -2.87, .55, .51)
  warm(1, 'Play room light', 1.32, 2.41, .60, 13)
  warm(1, 'Bath mirror light', 2.9, 2.43, -2.34, 11)

  const top = floors[2]!.root
  furniture(2, 27, -3.35, -2.08, { scale: .91, angle: -.46, solid: true })
  furniture(2, 31, -4.93, -1.78, { angle: Math.PI, solid: true })
  furniture(2, 28, -2.60, -2.71, { solid: true })
  furniture(2, 29, -2.6, -2.71, { y: .59 })
  furniture(2, 25, -3.43, -1.67)
  furniture(2, 40, 2.16, -2.69, { solid: true })
  furniture(2, 41, 2.16, -1.98, { solid: true })
  furniture(2, 11, 3.17, -2.71, { solid: true })
  furniture(2, 31, .28, -2.89, { angle: Math.PI / 2, scale: .76, solid: true })
  furniture(2, 24, -3.02, 2.72, { angle: Math.PI, solid: true })
  furniture(2, 25, -2.83, 1.7, { scale: 1.12 })
  furniture(2, 26, -3.05, 1.14, { solid: true })
  furniture(2, 33, -1.3, 2.25, { scale: .94 })
  furniture(2, 18, -4.73, 2.32, { scale: .87 })
  // 复刻视频 0:19 工作角：开源 CC0 GLB 书桌 + 双屏显示器 + 键鼠 + 台灯 + 人体工学椅，搭配定制吊柜与通顶衣柜
  const glbDesk = placeExtra(top, 'desk', -3.45, -2.76, { floorForSolid: 2 })
  if (!glbDesk) {
    box(top, 'Study desk top', [-3.45, .74, -2.76], [1.45, .045, .62], oak, 'oak')
    box(top, 'Study desk drawer base', [-4.02, .37, -2.76], [.32, .72, .56], '#f3f1ec', 'plaster')
    box(top, 'Study desk leg', [-2.78, .37, -2.76], [.06, .74, .52], frame, 'metal')
    footprint(2, -3.45, -2.76, 1.45, .62)
  }
  box(top, 'Study desk return', [-2.68, .73, -2.18], [.54, .04, 1.18], oak, 'oak')
  // 顶部白色吊柜（4格分缝 + 黑色拉手）
  for (let i = 0; i < 4; i++) {
    const cx = -4.05 + i * .56
    box(top, 'Study overhead cabinet', [cx, 2.26, -2.96], [.54, .68, .36], '#f3f1ec', 'plaster')
    box(top, 'Study cabinet handle', [cx + .18, 2.08, -2.77], [.018, .11, .018], '#2b2d30', 'metal')
  }
  // 左侧通顶衣柜（3门 + 黑色长拉手）
  for (let i = 0; i < 3; i++) {
    const wz = -2.35 + i * .58
    box(top, 'Tall wardrobe door', [-5.04, 1.28, wz], [.42, 2.52, .56], '#f3f1ec', 'plaster')
    box(top, 'Wardrobe bar handle', [-4.82, 1.22, wz + .18], [.018, .42, .018], '#2b2d30', 'metal')
  }
  footprint(2, -5.04, -1.77, .44, 1.76)
  // 开源 CC0 双屏显示器 + 键鼠 + 桌面灯
  if (!placeExtra(top, 'dual-monitors', -3.45, -2.90, { y: .74, scale: 1.08 })) {
    box(top, 'Main monitor frame', [-3.68, 1.02, -2.88], [.58, .35, .025], '#2a2d30', 'metal')
    box(top, 'Main monitor screen', [-3.68, 1.02, -2.865], [.54, .31, .008], '#eef3f5', 'screen')
  }
  if (!placeExtra(top, 'keyboard-mouse', -3.45, -2.64, { y: .74, scale: .92 })) {
    box(top, 'Keyboard', [-3.52, .768, -2.65], [.32, .014, .11], '#2e3136', 'metal')
  }
  placeExtra(top, 'desk-lamp', -3.96, -2.82, { y: .74, angle: .35 })
  mesh(top, 'Desk teal mug', cylGeo(.04, .036, .09, 12), [-2.96, .81, -2.66], '#65a6ad', 'ceramic')
  for (const [i, col] of ['#c8534b', '#5280a8', '#68996e', '#eae6dc'].entries()) {
    box(top, 'Desk book', [-2.68, .86, -1.96 + i * .055], [.18, .24, .042], col, 'matte')
  }
  if (!placeExtra(top, 'ergo-chair', -3.45, -2.14, { angle: Math.PI, floorForSolid: 2 })) {
    box(top, 'Ergo chair seat', [-3.45, .46, -2.18], [.46, .08, .44], '#787d82', 'fabric')
    box(top, 'Ergo chair back', [-3.45, .82, -1.96], [.42, .56, .08], '#787d82', 'fabric')
  }
  box(top, 'Loft rug', [-3.05, .008, 1.75], [2.55, .012, 1.85], '#e3dacb', 'fabric')
  placeExtra(top, 'bookshelf', -1.85, -2.95, { floorForSolid: 2 })
  placeExtra(top, 'floor-lamp', -4.70, 1.45, { floorForSolid: 2 })
  box(top, 'Loft pillow', [-3.55, .56, 2.66], [.32, .28, .14], green, 'fabric').rotateZ(-.12)
  box(top, 'Loft pillow', [-2.45, .56, 2.66], [.32, .28, .14], clay, 'fabric').rotateZ(.15)
  contactShadow(top, -3.05, 1.14, 1.45, .90)
  plant(top, 2.6, 2.34, 1.42)
  plant(top, -4.69, -.06, 1.0)
  for (const [i, color] of [clay, blue, green].entries()) {
    box(top, 'Sketchbook', [1.89 + i * .015, .77 + i * .022, -2.7], [.26, .021, .20], color, 'matte').rotateY(i * .16)
  }
  picture(top, -.69, 1.79, -3.164, blue, .54)
  picture(top, -1.43, 1.69, -3.164, clay, .49)
  cups(top, -3.13, .456, 1.20)
  mesh(top, 'Reading lamp shade', cylGeo(.11, .15, .17, 14), [-2.60, .94, -2.71], '#fff2d8', 'lamp')
  const reading = warm(2, 'Reading lamp glow', -2.60, .94, -2.71, 5.7)
  warm(2, 'Loft warm light', -2.64, 2.43, 1.38, 13)
  warm(2, 'Workshop warm light', 1.75, 2.41, -1.75, 11)

  // 四层：星空露台与空中花房（floors[3]）
  const terrace = floors[3]!.root
  box(terrace, 'Terrace wood deck', [-2.25, .014, .65], [3.6, .026, 3.3], '#c6a277', 'oak')
  box(terrace, 'Terrace outdoor sofa', [-2.55, .24, 1.55], [1.75, .42, .82], '#e5dfd1', 'fabric')
  box(terrace, 'Terrace sofa back', [-2.55, .54, 1.90], [1.75, .48, .16], '#d8d1c2', 'fabric')
  box(terrace, 'Terrace pillow', [-3.05, .56, 1.68], [.34, .28, .14], clay, 'fabric').rotateZ(.15)
  box(terrace, 'Terrace pillow', [-2.05, .56, 1.68], [.34, .28, .14], blue, 'fabric').rotateZ(-.14)
  footprint(3, -2.55, 1.55, 1.80, .92)
  if (!placeExtra(terrace, 'patio-table', -2.45, .15, { y: .02, scale: .88, floorForSolid: 3 })) {
    mesh(terrace, 'Terrace round table', cylGeo(.44, .44, .04, 18), [-2.50, .44, .20], oak, 'oak')
    mesh(terrace, 'Terrace table leg', cylGeo(.06, .16, .42, 12), [-2.50, .21, .20], frame, 'metal')
    footprint(3, -2.50, .20, .92, .92)
    cups(terrace, -2.58, .46, .22)
  }
  contactShadow(terrace, -2.55, 1.55, 1.9, 1.0)
  contactShadow(terrace, -2.45, .15, 1.2, 1.2)
  // 空中花房花箱 + 绿植 + 观星望远镜
  box(terrace, 'Garden planter box', [1.50, .26, -2.52], [2.25, .52, .68], '#b98f66', 'oak')
  footprint(3, 1.50, -2.52, 2.28, .72)
  for (const x of [.75, 1.50, 2.25]) plant(terrace, x, -2.52, .95, .52)
  plant(terrace, -4.55, -2.45, 1.35)
  plant(terrace, -4.55, 2.45, 1.18)
  const scopeTube = mesh(terrace, 'Telescope tube', cylGeo(.045, .065, .72, 12), [-4.25, 1.18, -.95], '#e9e5dc', 'metal')
  scopeTube.rotation.set(Math.PI / 3, .45, 0)
  mesh(terrace, 'Telescope tripod', cylGeo(.03, .26, .95, 6), [-4.25, .48, -.95], frame, 'metal')
  footprint(3, -4.25, -.95, .60, .60)
  // 露台暖光串灯
  for (let i = 0; i < 7; i++) {
    mesh(terrace, 'String light bulb', sphGeo(.048, 10, 8), [-4.4 + i * .92, 1.24, -3.14], '#ffe8b8', 'lamp')
    mesh(terrace, 'String light bulb', sphGeo(.048, 10, 8), [-4.4 + i * .92, 1.24, 3.14], '#ffe8b8', 'lamp')
  }
  warm(3, 'Terrace lounge light', -2.55, 1.85, .95, 14)
  warm(3, 'Terrace garden light', 1.45, 1.85, -2.05, 11)

  // 家里的小伙伴：优先使用开源 CC0 3D 宠物 GLB，缺失时回退到自建小柴
  function createPet(): HousePetRig {
    const root = new Group()
    root.name = 'Family Shiba pet'
    contactShadow(root, 0, 0, .58, .76, .008)
    const glbDog = placeExtra(root, 'pet-dog', 0, 0, { scale: .82 })
    if (glbDog) {
      return { root, legs: [], tail: null, head: null }
    }
    const tan = '#d69553'
    const creamFur = '#f6ebda'
    box(root, 'Pet torso', [0, .25, 0], [.22, .20, .38], tan, 'matte')
    box(root, 'Pet belly', [0, .185, .02], [.18, .08, .32], creamFur, 'matte')
    box(root, 'Pet collar', [0, .30, .17], [.20, .045, .06], '#5b8266', 'fabric')
    const head = new Group()
    head.position.set(0, .37, .22)
    root.add(head)
    box(head, 'Pet head', [0, .03, .02], [.20, .18, .19], tan, 'matte')
    box(head, 'Pet cheeks', [0, -.01, .06], [.21, .09, .12], creamFur, 'matte')
    box(head, 'Pet snout', [0, -.02, .13], [.09, .07, .09], creamFur, 'matte')
    box(head, 'Pet nose', [0, .005, .18], [.035, .025, .02], '#2c2926', 'matte')
    for (const side of [-1, 1]) {
      box(head, 'Pet eye', [side * .055, .05, .118], [.024, .026, .016], '#24211e', 'matte')
      const ear = box(head, 'Pet ear', [side * .068, .145, -.01], [.055, .08, .035], tan, 'matte')
      ear.rotation.z = -side * .18
    }
    const tail = new Group()
    tail.position.set(0, .32, -.19)
    root.add(tail)
    const tailMesh = box(tail, 'Pet tail', [0, .08, -.05], [.055, .16, .055], tan, 'matte')
    tailMesh.rotation.x = -.62
    const legOffsets: [number, number][] = [[-.07, .12], [.07, .12], [-.07, -.12], [.07, -.12]]
    const legs = legOffsets.map(([lx, lz]) => {
      const leg = new Group()
      leg.position.set(lx, .16, lz)
      root.add(leg)
      box(leg, 'Pet leg', [0, -.075, 0], [.055, .15, .055], tan, 'matte')
      box(leg, 'Pet paw', [0, -.145, .012], [.06, .03, .07], creamFur, 'matte')
      return leg
    })
    return { root, legs, tail, head }
  }
  const pet = createPet()
  pet.root.position.set(-1.75, 0, .55)
  house.add(pet.root)

  const localLamps = [
    { id: 'bedside', label: '床头灯', floor: 1, x: -1.95, z: -2.23, light: bedside },
    { id: 'reading', label: '阅读灯', floor: 2, x: -2.60, z: -2.71, light: reading },
  ]
  return { house, ground, roof, floors, doors, localLamps, emissiveMaterials, pet }
}

export const sceneBackdrop = new Color('#e9e4da')
