import {
  Box3, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color, CylinderGeometry, Group, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, NoColorSpace, PlaneGeometry, PointLight, Points, PointsMaterial,
  RepeatWrapping, SphereGeometry, SRGBColorSpace, Vector2, type Material, type Object3D, type Texture,
} from 'three'
import { floorRise, halfDepth, halfWidth, houseDepth, houseLevels, houseWidth, porch, stairs, type Bounds2D } from './familyHouseLayout'

export interface HouseDoor {
  id: string; label: string; floor: number; hinge: Group; x: number; z: number
  closed: Bounds2D; open: Bounds2D
}

export interface HouseSeat {
  id: string
  label: string
  floor: number
  x: number
  z: number
  seatX: number
  seatZ: number
  eyeY: number
  look: [number, number]
}

export interface HouseProp {
  id: string
  label: string
  offLabel: string
  shortLabel: string
  floor: number
  x: number
  z: number
  kind: 'tv' | 'coffee' | 'tap' | 'pc' | 'telescope' | 'fridge' | 'microwave' | 'bathtub' | 'pet-feed' | 'journal'
  update: (active: boolean, time: number) => void
}

export interface HousePetRig {
  root: Group
  legs: Group[]
  tail: Group | null
  head: Group | null
}

function makeCanvasTexture(
  size: number, repeatX: number, repeatY: number,
  draw: (ctx: CanvasRenderingContext2D, s: number) => void, srgb = true,
) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  draw(ctx, size)
  const tex = new CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.repeat.set(repeatX, repeatY)
  tex.colorSpace = srgb ? SRGBColorSpace : NoColorSpace
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

export interface PbrTextureSet {
  diff: Texture
  nor: Texture
  rough: Texture
}

export interface HousePbrTextures {
  wood: PbrTextureSet
  plaster: PbrTextureSet
  tile: PbrTextureSet
  grass: PbrTextureSet
}

export function buildFamilyHouse(
  source: Object3D,
  extras: Record<string, Object3D | null> = {},
  pbrTextures: Partial<HousePbrTextures> = {},
) {
  const house = new Group()
  house.name = 'Three-storey family home'
  const ground = new Group()
  const roof = new Group()
  const doors: HouseDoor[] = []
  const propsGroup = new Group()
  propsGroup.name = 'Interactive props'
  house.add(propsGroup)
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

  type MaterialKind = 'matte' | 'plaster' | 'oak' | 'fabric' | 'ceramic' | 'metal' | 'curtain' | 'lamp' | 'screen' | 'tile' | 'grass'
  const oakTex = makeCanvasTexture(256, 3, 2, (ctx, s) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, s, s)
    // 细密木纹纤维与年轮层次
    for (let i = 0; i < 64; i++) {
      const y = (i * 13) % s
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(116, 82, 46, 0.14)' : 'rgba(138, 102, 62, 0.08)'
      ctx.lineWidth = i % 5 === 0 ? 2 : 1
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.bezierCurveTo(s * 0.3, y + ((i % 2 ? 1 : -1) * 4), s * 0.7, y + ((i % 2 ? -1 : 1) * 4), s, y)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(105, 74, 42, 0.22)'
    ctx.lineWidth = 2
    for (let y = 0; y < s; y += 32) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(s, y)
      ctx.stroke()
    }
    // 细微木结
    for (const [kx, ky, kr] of [[68, 48, 8], [192, 144, 6], [124, 208, 7]] as const) {
      const grad = ctx.createRadialGradient(kx, ky, 1, kx, ky, kr * 2)
      grad.addColorStop(0, 'rgba(110, 78, 46, 0.20)')
      grad.addColorStop(1, 'rgba(110, 78, 46, 0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.ellipse(kx, ky, kr * 2.2, kr, 0.1, 0, Math.PI * 2)
      ctx.fill()
    }
  })
  const oakBumpTex = makeCanvasTexture(256, 3, 2, (ctx, s) => {
    ctx.fillStyle = '#808080'
    ctx.fillRect(0, 0, s, s)
    for (let i = 0; i < 64; i++) {
      const y = (i * 13) % s
      ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.18)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.bezierCurveTo(s * 0.35, y + 3, s * 0.65, y - 3, s, y)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.42)'
    ctx.lineWidth = 2
    for (let y = 0; y < s; y += 32) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke()
    }
  }, false)
  const oakRoughTex = makeCanvasTexture(256, 3, 2, (ctx, s) => {
    ctx.fillStyle = '#8a8a8a'
    ctx.fillRect(0, 0, s, s)
    for (let i = 0; i < 48; i++) {
      const y = (i * 17) % s
      ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,0.18)' : 'rgba(40,40,40,0.22)'
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke()
    }
  }, false)
  const plasterTex = makeCanvasTexture(256, 4, 4, (ctx, s) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, s, s)
    for (let i = 0; i < 900; i++) {
      const x = (i * 73) % s
      const y = (i * 139) % s
      ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.024)' : 'rgba(255,255,255,0.04)'
      ctx.fillRect(x, y, 2, 2)
    }
  })
  const plasterBumpTex = makeCanvasTexture(256, 4, 4, (ctx, s) => {
    ctx.fillStyle = '#808080'
    ctx.fillRect(0, 0, s, s)
    for (let i = 0; i < 1100; i++) {
      const x = (i * 67) % s
      const y = (i * 127) % s
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'
      ctx.fillRect(x, y, 2, 2)
    }
  }, false)
  const fabricTex = makeCanvasTexture(128, 10, 10, (ctx, s) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, s, s)
    for (let y = 0; y < s; y += 4) {
      ctx.fillStyle = y % 8 === 0 ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.02)'
      ctx.fillRect(0, y, s, 1)
    }
    for (let x = 0; x < s; x += 4) {
      ctx.fillStyle = x % 8 === 0 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)'
      ctx.fillRect(x, 0, 1, s)
    }
  })
  const fabricBumpTex = makeCanvasTexture(128, 10, 10, (ctx, s) => {
    ctx.fillStyle = '#808080'
    ctx.fillRect(0, 0, s, s)
    for (let y = 0; y < s; y += 4) {
      ctx.fillStyle = y % 8 === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)'
      ctx.fillRect(0, y, s, 2)
    }
    for (let x = 0; x < s; x += 4) {
      ctx.fillStyle = x % 8 === 0 ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.16)'
      ctx.fillRect(x, 0, 2, s)
    }
  }, false)
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
      if (kind === 'oak') {
        const wood = pbrTextures.wood
        found = wood
          ? new MeshStandardMaterial({
            color: '#ebd4b4', map: wood.diff, normalMap: wood.nor, normalScale: new Vector2(.55, .55),
            roughnessMap: wood.rough, roughness: .68, envMapIntensity: .88,
          })
          : new MeshStandardMaterial({
            color, map: oakTex, bumpMap: oakBumpTex, bumpScale: .015, roughnessMap: oakRoughTex,
            roughness: .54, envMapIntensity: .90,
          })
      } else if (kind === 'plaster') {
        const plas = pbrTextures.plaster
        found = plas
          ? new MeshStandardMaterial({
            color, normalMap: plas.nor, normalScale: new Vector2(.14, .14),
            roughnessMap: plas.rough, roughness: .92, envMapIntensity: .68,
          })
          : new MeshStandardMaterial({
            color, map: plasterTex, bumpMap: plasterBumpTex, bumpScale: .005, roughness: .90, envMapIntensity: .68,
          })
      } else if (kind === 'tile') {
        const tl = pbrTextures.tile
        found = tl
          ? new MeshStandardMaterial({
            color, map: tl.diff, normalMap: tl.nor, normalScale: new Vector2(.78, .78),
            roughnessMap: tl.rough, roughness: .42, envMapIntensity: 1.05,
          })
          : new MeshStandardMaterial({ color, roughness: .22, metalness: .04, envMapIntensity: 1.15 })
      } else if (kind === 'grass') {
        const gr = pbrTextures.grass
        found = gr
          ? new MeshStandardMaterial({
            color, map: gr.diff, normalMap: gr.nor, normalScale: new Vector2(.82, .82),
            roughnessMap: gr.rough, roughness: .95, envMapIntensity: .45,
          })
          : new MeshStandardMaterial({ color, roughness: .94, envMapIntensity: .45 })
      } else if (kind === 'fabric') {
        found = new MeshStandardMaterial({
          color, map: fabricTex, bumpMap: fabricBumpTex, bumpScale: .014, roughness: .94, envMapIntensity: .55,
        })
      } else if (kind === 'ceramic') {
        found = new MeshStandardMaterial({ color, roughness: .14, metalness: .04, envMapIntensity: 1.25 })
      } else if (kind === 'metal') {
        found = new MeshStandardMaterial({ color, roughness: .24, metalness: .82, envMapIntensity: 1.20 })
      } else if (kind === 'curtain') {
        found = new MeshStandardMaterial({
          color, map: fabricTex, roughness: .86, transparent: true, opacity: .76, depthWrite: false,
        })
      } else if (kind === 'lamp') {
        found = new MeshStandardMaterial({ color, emissive: '#ffd7a3', emissiveIntensity: 1.25, roughness: .42 })
        emissiveMaterials.push(found)
      } else if (kind === 'screen') {
        found = new MeshStandardMaterial({ color, emissive: '#9dc4d8', emissiveIntensity: .55, roughness: .22 })
        emissiveMaterials.push(found)
      } else found = new MeshStandardMaterial({ color, roughness: .78, envMapIntensity: .75 })
      materials.set(key, found)
    }
    return found
  }
  const enhancedMaterials = new WeakSet<Material>()
  const hslScratch = { h: 0, s: 0, l: 0 }
  function enhanceGlbObject(root: Object3D) {
    root.traverse(child => {
      if (!(child instanceof Mesh)) return
      const hasUv = Boolean(child.geometry?.getAttribute('uv'))
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      for (const mat of mats) {
        if (!(mat instanceof MeshStandardMaterial) || enhancedMaterials.has(mat)) continue
        enhancedMaterials.add(mat)
        mat.envMapIntensity = mat.metalness >= .45 || mat.roughness < .28 ? 1.25 : .92
        if (hasUv && !mat.map && !mat.normalMap && !mat.bumpMap) {
          mat.color.getHSL(hslScratch)
          const isWarmWood = mat.metalness < .2 && mat.roughness >= .32 && mat.roughness < .74
            && hslScratch.h >= .03 && hslScratch.h <= .15 && hslScratch.s >= .18
          if (isWarmWood) {
            mat.bumpMap = oakBumpTex
            mat.bumpScale = .011
          } else if (mat.metalness < .2 && mat.roughness >= .72) {
            mat.bumpMap = fabricBumpTex
            mat.bumpScale = .010
          }
        }
        mat.needsUpdate = true
      }
    })
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
  const plaster = '#f4f5f2'
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
    enhanceGlbObject(object)
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
    enhanceGlbObject(object)
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
    const artTex = makeCanvasTexture(128, 1, 1, (ctx, s) => {
      ctx.fillStyle = '#faf3e4'
      ctx.fillRect(0, 0, s, s)
      const grad = ctx.createLinearGradient(0, 0, 0, s)
      grad.addColorStop(0, '#f7ebd5')
      grad.addColorStop(1, '#e8dcc6')
      ctx.fillStyle = grad
      ctx.fillRect(10, 10, s - 20, s - 20)
      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.arc(s * .45, s * .42, s * .22, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = green
      ctx.beginPath()
      ctx.moveTo(14, s - 14)
      ctx.quadraticCurveTo(s * .5, s * .56, s - 14, s - 14)
      ctx.fill()
      ctx.strokeStyle = '#6f7c6b'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(s * .68, s - 16)
      ctx.quadraticCurveTo(s * .66, s * .48, s * .76, s * .30)
      ctx.stroke()
    })
    const artMat = new MeshStandardMaterial({ map: artTex, roughness: .75 })
    const artMesh = new Mesh(boxGeo(width - .05, .435, .012), artMat)
    artMesh.position.set(x, y, z + .020)
    parent.add(artMesh)
  }
  function cups(parent: Group, x: number, y: number, z: number) {
    for (const [i, color] of [blue, clay].entries()) {
      mesh(parent, 'Stoneware cup', cylGeo(.055, .046, .084, 13), [x + .19 * i, y + .042, z], color, 'ceramic')
      mesh(parent, 'Stoneware cup inset', cylGeo(.04, .04, .006, 13), [x + .19 * i, y + .086, z], '#92725c', 'matte')
    }
  }
  function curtains(parent: Group, x: number, z: number, width: number, offsetZ: number) {
    box(parent, 'Curtain rod', [x, 2.34, z + offsetZ], [width + .34, .024, .024], '#242829', 'metal')
    if (width > 1.8) {
      const blindColors = ['#e7b9bc', '#242829', '#f4f3ee', '#6db399', '#f4f3ee']
      const panelW = Math.min(.42, (width - .22) / blindColors.length)
      const startX = x - (blindColors.length - 1) * panelW * .52
      blindColors.forEach((col, i) => {
        const dropH = i % 2 === 1 ? .74 : .64
        box(parent, 'Color block blind', [startX + i * panelW * 1.04, 2.32 - dropH / 2, z + offsetZ], [panelW - .02, dropH, .016], col, 'fabric')
      })
    }
    for (const side of [-1, 1]) {
      box(parent, 'Linen curtain', [x + side * (width / 2 - .07), 1.56, z + offsetZ], [.22, 1.52, .04], '#f4f2ec', 'curtain')
    }
  }
  function wallClock(parent: Group, x: number, y: number, z: number) {
    const rim = mesh(parent, 'Wall clock rim', cylGeo(.20, .20, .032, 20), [x, y, z], oak, 'oak')
    rim.rotation.x = Math.PI / 2
    const face = mesh(parent, 'Wall clock face', cylGeo(.175, .175, .036, 20), [x, y, z + .002], '#fbf8f1', 'matte')
    face.rotation.x = Math.PI / 2
    const hourGroup = new Group()
    hourGroup.position.set(x, y, z + .024)
    propsGroup.add(hourGroup)
    box(hourGroup, 'Clock hour hand', [0, .042, 0], [.014, .084, .008], frame, 'metal')
    const minuteGroup = new Group()
    minuteGroup.position.set(x, y, z + .028)
    propsGroup.add(minuteGroup)
    box(minuteGroup, 'Clock minute hand', [0, .058, 0], [.010, .116, .008], clay, 'metal')
    return { hourGroup, minuteGroup }
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
  function plankFloor(parent: Group, x: number, z: number, w: number, d: number, withCeiling = false) {
    box(parent, 'Oak floor slab', [x, -.078, z], [w, .156, d], '#e8d6be', 'oak')
    if (withCeiling) box(parent, 'White ceiling soffit', [x, -.162, z], [w, .012, d], '#f6f7f4', 'plaster')
    if (pbrTextures.wood) return
    const rows = Math.ceil(d / .34)
    for (let i = 0; i < rows; i++) {
      const depth = d / rows
      box(parent, 'Oak floor board', [x, -.004, z - d / 2 + depth * (i + .5)], [w - .005, .01, depth - .004],
        ['#d7b992', '#d2b28a', '#d9bd99', '#dbbf99', '#d8b891'][i % 5]!, 'oak')
    }
  }

  for (const [index, floor] of floors.entries()) {
    const isTerrace = index === 3
    const hasCeiling = index > 0
    plankFloor(floor.root, (stairs.left - halfWidth) / 2, 0, stairs.left + halfWidth, houseDepth, hasCeiling)
    const stairWidth = halfWidth - stairs.left
    const stairCenter = stairs.left + stairWidth / 2
    if (index === 0) plankFloor(floor.root, stairCenter, 0, stairWidth, houseDepth, false)
    else {
      plankFloor(floor.root, stairCenter, (-halfDepth + stairs.back) / 2, stairWidth, stairs.back + halfDepth, hasCeiling)
      plankFloor(floor.root, stairCenter, (halfDepth + stairs.front) / 2, stairWidth, halfDepth - stairs.front, hasCeiling)
    }
    const wallZ = halfDepth - .03
    const wallX = halfWidth - .08
    if (isTerrace) {
      // 屋顶露台：四周 1.05m 女儿墙 + 木扶手，留出开阔天空视野
      for (const sign of [-1, 1]) {
        const target = sign > 0 ? floor.front : floor.root
        box(target, 'Terrace parapet', [0, .52, sign * wallZ], [houseWidth, 1.04, .18], plaster, 'plaster')
        box(target, 'Terrace coping', [0, 1.06, sign * wallZ], [houseWidth + .06, .06, .24], oak, 'oak')
        box(floor.root, 'Terrace side parapet', [sign * (halfWidth - .09), .52, 0], [.18, 1.04, houseDepth - .18], plaster, 'plaster')
        box(floor.root, 'Terrace side coping', [sign * (halfWidth - .09), 1.06, 0], [.24, .06, houseDepth - .10], oak, 'oak')
      }
    } else {
      alongX(floor.root, 'North wall', -halfWidth, halfWidth, -wallZ, [[-4.4, 2.8], [1.25, 2.8], [5.85, 1.0]], true)
      const doorX = porch.position[0]
      const doorLeft = doorX - .64
      const doorRight = doorX + .64
      const start = index === 0 ? doorLeft : halfWidth
      alongX(floor.front, 'Front wall', -halfWidth, start, wallZ, [[-4.1, 2.8], [.45, 2.3]], true)
      // 踢脚线收口
      box(floor.root, 'North baseboard', [0, .045, -(wallZ - .095)], [houseWidth - .32, .09, .022], oak, 'oak')
      box(floor.front, 'Front baseboard', [(-halfWidth + doorLeft) / 2, .045, wallZ - .095], [doorLeft + halfWidth - .32, .09, .022], oak, 'oak')
      if (index === 0) {
        box(floor.front, 'Entrance door surround', [doorX, 2.54, wallZ], [1.29, .32, .18], plaster, 'plaster')
        const hinge = new Group()
        hinge.name = 'Entrance door hinge'
        hinge.position.set(doorX - .61, 0, wallZ)
        floor.front.add(hinge)
        box(hinge, 'Oak entrance door', [.61, 1.107, 0], [1.22, 2.21, .081], '#ad805b', 'oak')
        box(hinge, 'Inset upper panel', [.61, 1.57, .046], [.92, .75, .012], '#b99573', 'oak')
        box(hinge, 'Inset lower panel', [.61, .55, .046], [.92, .85, .012], '#b99573', 'oak')
        box(hinge, 'Entrance door handle', [1.07, 1.02, .065], [.034, .23, .060], frame, 'metal')
        doors.push({ id: 'entrance', label: '入户门', floor: 0, hinge, x: doorX, z: wallZ,
          closed: { left: doorX - .63, right: doorX + .63, back: wallZ - .05, front: wallZ + .05 },
          open: { left: doorX - .65, right: doorX - .56, back: wallZ - 1.245, front: wallZ + .04 } })
        box(floor.front, 'Entrance stair wall', [(doorRight + halfWidth) / 2, 1.35, wallZ], [halfWidth - doorRight, 2.7, .17], plaster, 'plaster')
      }
      for (const side of [-1, 1]) {
        const x = side * wallX
        const sideWall = new Group()
        sideWall.position.x = x
        sideWall.rotation.y = Math.PI / 2
        floor.root.add(sideWall)
        alongX(sideWall, 'Side wall', -wallZ, wallZ, 0, [[-1.3, 1.8], [1.85, 1.5]])
        box(floor.root, 'Side baseboard', [x - side * .09, .045, 0], [.022, .09, houseDepth - .24], oak, 'oak')
      }
    }
    const rail = new Group()
    rail.name = 'Stair guard'
    floor.root.add(rail)
    const railLength = stairs.front - stairs.back
    for (let i = 0; i < 13; i++) box(rail, 'Oak stair baluster', [stairs.left, .46, stairs.back + railLength * i / 12], [.055, .92, .055], oak, 'oak')
    box(rail, 'Oak stair handrail', [stairs.left, .94, (stairs.back + stairs.front) / 2], [.075, .075, railLength], oak, 'oak')
    if (index > 0) box(floor.root, 'Stairwell back guard', [stairCenter, .47, stairs.back], [stairWidth, .94, .07], '#c3a581', 'oak')
    box(floor.root, 'Front floor edge', [0, -.097, halfDepth + .01], [houseWidth + .08, .20, .12], plaster, 'plaster')
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
  for (const x of [-5.6, -2.0]) {
    box(roof, 'Pergola post', [x, 9.65, -3.1], [.11, 2.5, .11], oak, 'oak')
    box(roof, 'Pergola post', [x, 9.65, .5], [.11, 2.5, .11], oak, 'oak')
  }
  for (let i = 0; i < 6; i++) {
    box(roof, 'Pergola beam', [-3.8, 10.92, -3.0 + i * .68], [4.0, .08, .09], oak, 'oak')
  }
  box(ground, 'Garden base', [0, -.27, .48], [houseWidth + 2.2, .21, houseDepth + 2.1], '#dce3ce', 'grass')
  box(ground, 'Garden path', [porch.position[0], -.154, halfDepth + .76], [1.65, .028, 1.50], '#c8bfb0')
  box(ground, 'Doorstep', [porch.position[0], -.068, halfDepth + .24], [1.68, .156, .55], '#bcb2a1')
  box(ground, 'Coconut coir doormat', [porch.position[0], .015, halfDepth + .25], [.78, .022, .36], '#83694b', 'fabric')
  for (let stripe = 0; stripe < 5; stripe++)
    box(ground, 'Doormat weave', [porch.position[0], .027, halfDepth + .11 + .068 * stripe], [.69, .004, .018], '#a98e68', 'fabric')
  box(ground, 'Oak door canopy', [porch.position[0], 2.48, halfDepth + .21], [1.68, .12, .69], '#b69779', 'oak')
  box(ground, 'Porch light', [porch.position[0] + .72, 2.13, halfDepth + .08], [.10, .24, .13], '#ffefcf', 'lamp')
  for (const x of [-5.4, -3.3, 1.15]) plant(ground, x, halfDepth + .56, 1.15)

  const living = floors[0]!.root
  // 一层连通楼房户型：西北角隔出宽敞工作间（1.4m 门洞连通客厅与厨房）
  box(living, 'Study south partition', [-5.10, 1.35, -.35], [3.10, 2.70, .14], plaster, 'plaster')
  box(living, 'Study south header', [-2.85, 2.40, -.35], [1.40, .60, .14], plaster, 'plaster')
  footprint(0, -5.10, -.35, 3.10, .14)
  box(living, 'Study east partition', [-2.15, 1.35, -2.90], [.14, 2.70, 2.30], plaster, 'plaster')
  box(living, 'Study east header', [-2.15, 2.40, -1.05], [.14, .60, 1.40], plaster, 'plaster')
  footprint(0, -2.15, -2.90, .14, 2.30)
  // 一层工作间内配置：开源 GLB 书桌 + 双屏 + 键鼠 + 人体工学椅 + 钢木书架
  placeExtra(living, 'desk', -4.45, -3.65, { floorForSolid: 0 })
  placeExtra(living, 'dual-monitors', -4.45, -3.79, { y: .74, scale: 1.05 })
  placeExtra(living, 'keyboard-mouse', -4.45, -3.53, { y: .74, scale: .92 })
  placeExtra(living, 'desk-lamp', -4.98, -3.70, { y: .74, angle: .35 })
  placeExtra(living, 'ergo-chair', -4.45, -2.85, { angle: Math.PI, floorForSolid: 0 })
  if (!placeExtra(living, 'steel-shelf', -6.38, -2.10, { scale: .09, angle: Math.PI / 2, floorForSolid: 0 })) {
    placeExtra(living, 'bookshelf', -6.38, -2.10, { angle: Math.PI / 2, floorForSolid: 0 })
  }
  placeExtra(living, 'display-shelf', -1.60, 2.85, { floorForSolid: 0 })
  plant(living, -2.70, -3.65, .92)
  const studyCeiling = warm(0, 'Study1F warm light', -4.30, 2.40, -2.20, 12)

  // 一层客厅：开阔布局，使用现代 CC0 3D 沙发、茶几、单人椅、餐桌椅与冰箱
  if (!placeExtra(living, 'sofa-3seat', -3.95, .72, { floorForSolid: 0 })) furniture(0, 24, -3.95, .72, { solid: true })
  if (!placeExtra(living, 'coffee-table', -3.95, 1.95, { floorForSolid: 0 })) furniture(0, 26, -3.95, 1.95, { solid: true })
  if (!placeExtra(living, 'armchair', -5.75, 2.05, { angle: 1.15, floorForSolid: 0 })) furniture(0, 27, -5.75, 2.05, { scale: .84, angle: 1.15, solid: true })
  if (!placeExtra(living, 'dining-table', 1.25, .45, { floorForSolid: 0 })) {
    furniture(0, 34, 1.25, .45, { solid: true })
    box(living, 'Linen table runner', [1.25, .831, .45], [1.46, .004, .29], '#e7dbc6', 'fabric')
    cups(living, .72, .837, .53)
  }
  if (!placeExtra(living, 'dining-chair', .45, -.25, { floorForSolid: 0 })) furniture(0, 35, .45, -.35, { solid: true })
  if (!placeExtra(living, 'dining-chair', 2.05, -.25, { floorForSolid: 0 })) furniture(0, 36, 2.05, -.35, { solid: true })
  if (!placeExtra(living, 'dining-chair', .45, 1.15, { angle: Math.PI, floorForSolid: 0 })) furniture(0, 38, 1.25, 1.28, { solid: true })
  placeExtra(living, 'dining-chair', 2.05, 1.15, { angle: Math.PI, floorForSolid: 0 })
  furniture(0, 39, 1.25, .45, { y: 1.43 })
  furniture(0, 32, 1.20, 3.72, { angle: Math.PI / 2, scale: .76, solid: true })
  // 一楼细节：薄荷绿拼色几何地毯、时钟、玄关托盘、接触阴影、厨房小家电
  box(living, 'Living woven rug', [-3.95, .008, 1.85], [3.40, .012, 2.45], '#eef2ee', 'fabric')
  box(living, 'Living rug mint block A', [-4.68, .015, 1.25], [1.22, .004, 1.15], '#6ab399', 'fabric')
  box(living, 'Living rug mint block B', [-3.12, .015, 2.40], [1.32, .004, 1.18], '#cfe3d8', 'fabric')
  box(living, 'Living rug accent strip', [-3.95, .015, 2.42], [.72, .004, .98], '#6ab399', 'fabric')
  const clockHands = wallClock(living, -.58, 1.95, -4.065)
  box(living, 'Entrance tray', [1.20, .81, 3.71], [.28, .022, .18], oak, 'oak')
  // 餐桌花瓶与果盘 + 玄关伞桶与门铃
  mesh(living, 'Dining vase', cylGeo(.045, .062, .16, 12), [1.25, .86, .45], '#e9e2d4', 'ceramic')
  mesh(living, 'Dining flower', sphGeo(.075, 10, 8), [1.25, .98, .45], '#7a9e6d', 'matte')
  mesh(living, 'Fruit bowl', cylGeo(.12, .07, .055, 14), [1.58, .81, .38], oak, 'oak')
  mesh(living, 'Fruit', sphGeo(.035, 8, 6), [1.55, .85, .37], clay, 'matte')
  mesh(living, 'Fruit', sphGeo(.032, 8, 6), [1.61, .85, .40], '#e0b85c', 'matte')
  mesh(living, 'Umbrella stand', cylGeo(.11, .10, .44, 12), [1.65, .22, 3.82], '#5f6b64', 'metal')
  box(living, 'Doorbell button', [3.55, 1.32, 4.18], [.06, .09, .02], '#e8e4da', 'ceramic')
  box(living, 'Cutting board', [1.15, .96, -3.64], [.34, .018, .24], oak, 'oak')
  box(living, 'Kettle', [2.55, 1.04, -3.72], [.16, .18, .16], '#e6e2d8', 'ceramic')
  box(living, 'Spice jar', [1.46, .99, -3.82], [.06, .10, .06], clay, 'ceramic')
  box(living, 'Spice jar', [1.55, .99, -3.82], [.06, .10, .06], green, 'ceramic')
  contactShadow(living, -3.95, 1.95, 1.55, .95)
  contactShadow(living, 1.25, .45, 1.95, 1.45)
  placeExtra(living, 'pet-bed', -2.15, 1.35, { scale: .92 })
  placeExtra(living, 'pet-bowls', -1.45, 1.35, { scale: .85 })
  placeExtra(living, 'tv-unit', -3.95, 3.72, { angle: Math.PI, floorForSolid: 0 })
  placeExtra(living, 'floor-lamp', -6.15, .72, { floorForSolid: 0 })
  placeExtra(living, 'sideboard', 3.85, .45, { angle: -Math.PI / 2, floorForSolid: 0 })
  placeExtra(living, 'cat-tree', -6.20, 3.40, { floorForSolid: 0 })
  placeExtra(living, 'shoe-rack', 2.05, 3.78, { angle: Math.PI, floorForSolid: 0 })
  placeExtra(living, 'coffee-maker', -.45, -3.72, { y: .95 })
  placeExtra(living, 'microwave', 2.65, -3.72, { y: .95 })
  plant(living, -5.25, 3.65, 1.28)
  plant(living, -1.65, -3.70, .90)
  box(living, 'Kitchen counter', [1.10, .91, -3.68], [4.20, .075, .69], '#f0ebe0', 'ceramic')
  box(living, 'Kitchen tile backsplash sill', [1.10, 1.03, -4.06], [4.20, .16, .025], '#eef2f0', 'tile')
  box(living, 'Kitchen tile backsplash left', [-.58, 1.48, -4.06], [.84, 1.06, .025], '#eef2f0', 'tile')
  box(living, 'Kitchen tile backsplash right', [2.92, 1.48, -4.06], [.55, 1.06, .025], '#eef2f0', 'tile')
  for (let i = 0; i < 6; i++) {
    const x = -.62 + .685 * i
    box(living, 'Sage kitchen cabinet', [x, .45, -3.69], [.66, .88, .60], green, 'matte')
    box(living, 'Cabinet pull', [x, .74, -3.366], [.19, .024, .043], frame, 'metal')
  }
  footprint(0, 1.10, -3.68, 4.20, .69)
  box(living, 'Sink insert', [.25, .952, -3.70], [.54, .012, .38], '#9da5a4', 'metal')
  box(living, 'Kitchen tap', [.25, 1.075, -3.88], [.043, .245, .04], frame, 'metal')
  box(living, 'Cooktop', [1.95, .954, -3.70], [.58, .014, .42], '#555a56', 'metal')
  for (const x of [1.80, 2.10]) for (const z of [-3.80, -3.58])
    mesh(living, 'Hob ring', new CylinderGeometry(.077, .077, .012, 16), [x, .967, z], '#929290')
  if (!placeExtra(living, 'fridge', 3.85, -3.68, { floorForSolid: 0 })) {
    box(living, 'Cream fridge', [3.85, .91, -3.68], [.60, 1.82, .62], cream)
    box(living, 'Fridge handle', [3.63, 1.05, -3.341], [.028, .29, .054], frame)
    footprint(0, 3.85, -3.68, .62, .66)
  }
  box(living, 'Book on coffee table', [-4.05, .418, 1.95], [.24, .035, .19], clay, 'matte').rotateY(.14)
  picture(living, -1.55, 1.71, -4.064, clay, .43)
  picture(living, -.62, 1.48, -4.064, blue, .46)
  // 墙面原木长隔板 + 绿植 + 彩色竖放书列 + 窗边粉色小椅（避开 display-shelf 与电视视线）
  box(living, 'Wall oak shelf', [-1.25, 2.02, -3.94], [1.05, .035, .24], oak, 'oak')
  box(living, 'Shelf book row', [-1.55, 2.15, -3.94], [.05, .22, .16], '#2e3136', 'matte')
  box(living, 'Shelf book row', [-1.49, 2.14, -3.94], [.045, .20, .16], '#c8534b', 'matte')
  box(living, 'Shelf book row', [-1.43, 2.16, -3.94], [.048, .23, .16], '#ebe6da', 'matte')
  box(living, 'Shelf book row', [-1.37, 2.13, -3.94], [.045, .19, .16], '#5ea0a7', 'matte')
  mesh(living, 'Shelf pot', cylGeo(.065, .05, .11, 12), [-.94, 2.09, -3.94], '#eae5da', 'ceramic')
  mesh(living, 'Shelf plant', sphGeo(.09, 10, 8), [-.94, 2.19, -3.94], '#6f9162', 'matte')
  // 窗边粉色小椅子（靠南窗，避开客厅展示架）
  box(living, 'Pink chair seat', [-2.55, .44, 3.35], [.44, .06, .42], '#e8b3b8', 'fabric')
  box(living, 'Pink chair back', [-2.55, .69, 3.53], [.42, .44, .06], '#e8b3b8', 'fabric')
  for (const lx of [-2.72, -2.38]) for (const lz of [3.18, 3.51]) {
    box(living, 'Pink chair leg', [lx, .21, lz], [.035, .42, .035], oak, 'oak')
  }
  footprint(0, -2.55, 3.35, .48, .46)
  // 一楼自发光灯具（餐桌吊灯罩 + 客厅吸顶灯）
  mesh(living, 'Dining pendant shade', cylGeo(.22, .30, .16, 16), [1.25, 2.02, .45], '#fff2d8', 'lamp')
  mesh(living, 'Living ceiling fixture', cylGeo(.22, .22, .05, 16), [-3.95, 2.55, 1.65], '#fff2d8', 'lamp')
  const diningPendant = warm(0, 'Dining pendant glow', 1.25, 1.97, .45, 12)
  const livingCeiling = warm(0, 'Sofa corner warm light', -3.95, 2.42, 1.65, 14)
  warm(0, 'Kitchen warm light', 1.15, 2.39, -2.65, 12)

  const sleeping = floors[1]!.root
  const bedroomDoor = furniture(1, 8, -.90, 0)
  const leaves = bedroomDoor.children.filter(child => child.name.includes('door-leaf'))
  if (leaves.length !== 2) throw new Error('Bedroom door is missing its leaf or handle')
  const door = new Group()
  door.name = 'Bedroom door hinge'
  door.position.set(-.898, 0, .444)
  sleeping.add(door)
  for (const leaf of leaves) door.attach(leaf)
  for (const z of [-2.28, 2.28]) box(sleeping, 'Bedroom partition', [-.90, 1.35, z], [.16, 2.70, 3.68], plaster, 'plaster')
  for (const z of [-2.28, 2.28]) footprint(1, -.90, z, .16, 3.68)
  const closedDoor = { left: -.941, right: -.855, front: .45, back: -.45 }
  const openDoor = { left: -1.81, right: -.87, front: .49, back: .40 }
  doors.push({ id: 'bedroom', label: '卧室门', floor: 1, hinge: door, x: -.90, z: 0, closed: closedDoor, open: openDoor })

  // 二楼浴室门（可按 E 开关）
  const bathHinge = new Group()
  bathHinge.name = 'Bathroom door hinge'
  bathHinge.position.set(3.10, 0, -1.15)
  sleeping.add(bathHinge)
  box(bathHinge, 'Bathroom door leaf', [.45, 1.06, 0], [.90, 2.12, .055], '#e9e4d8', 'oak')
  box(bathHinge, 'Bathroom frosted glass', [.45, 1.36, 0], [.56, .84, .062], '#d6e3e2', 'curtain')
  box(bathHinge, 'Bathroom door handle', [.80, 1.02, .042], [.025, .14, .045], frame, 'metal')
  doors.push({
    id: 'bath-door', label: '浴室门', floor: 1, hinge: bathHinge, x: 3.55, z: -1.15,
    closed: { left: 3.09, right: 4.00, back: -1.19, front: -1.11 },
    open: { left: 3.06, right: 3.14, back: -2.05, front: -1.13 },
  })

  if (!placeExtra(sleeping, 'double-bed', -4.05, -1.65, { floorForSolid: 1 })) {
    furniture(1, 9, -4.05, -1.65, { solid: true })
    furniture(1, 10, -3.98, -.87)
    furniture(1, 14, -4.00, -1.32, { y: .71 })
    box(sleeping, 'Teal bed mattress layer', [-4.05, .38, -1.51], [1.72, .05, 1.78], '#8cc4ca', 'fabric')
    box(sleeping, 'White bed pillow', [-4.38, .45, -2.21], [.52, .10, .34], '#f7f5f0', 'fabric')
    box(sleeping, 'White bed pillow', [-3.72, .45, -2.21], [.52, .10, .34], '#f7f5f0', 'fabric')
  }
  furniture(1, 11, -2.55, -2.65, { solid: true })
  furniture(1, 12, -2.55, -2.65, { y: .54 })
  if (!placeExtra(sleeping, 'armchair', -5.95, .65, { angle: .85, floorForSolid: 1 })) {
    furniture(1, 17, -5.95, .65, { scale: .96, solid: true })
  }
  if (!placeExtra(sleeping, 'wardrobe', -2.25, 3.58, { angle: Math.PI, floorForSolid: 1 })) {
    furniture(1, 21, -2.25, 3.58, { angle: Math.PI, solid: true })
  }
  contactShadow(sleeping, -4.05, -1.65, 2.1, 2.2)
  box(sleeping, 'Bedroom rug', [-4.05, .008, .75], [2.60, .012, 1.80], '#dde3dc', 'fabric')
  placeExtra(sleeping, 'floor-lamp', -5.95, -3.25, { floorForSolid: 1 })
  placeExtra(sleeping, 'bookshelf', -6.38, 2.75, { angle: Math.PI / 2, floorForSolid: 1 })
  box(sleeping, 'Playroom rug', [.55, .008, 1.35], [2.05, .012, 1.85], '#ede3d1', 'fabric')
  mesh(sleeping, 'Bedside lamp shade', cylGeo(.11, .14, .16, 14), [-2.55, .88, -2.65], '#fff2d8', 'lamp')
  // 床头小闹钟与睡前读物
  box(sleeping, 'Bedside alarm clock', [-2.36, .60, -2.62], [.09, .08, .04], '#4f5a55', 'metal')
  box(sleeping, 'Bedside book', [-2.68, .57, -2.55], [.18, .035, .14], clay, 'matte').rotateY(.12)
  const bedside = warm(1, 'Bedside lamp glow', -2.55, .88, -2.65, 5.5)
  warm(1, 'Bedroom ceiling light', -3.85, 2.4, -.65, 14)

  furniture(1, 9, .48, -2.45, { scale: .76, solid: true })
  furniture(1, 14, .49, -2.24, { y: .52, scale: .66 })
  furniture(1, 25, .55, 1.35, { scale: .96 })
  furniture(1, 33, -.15, 1.35, { scale: .88 })
  furniture(1, 33, 1.35, 1.85, { scale: .74 })
  furniture(1, 31, 1.10, 3.72, { angle: Math.PI / 2, scale: .74, solid: true })
  for (let i = 0; i < 6; i++) {
    box(sleeping, 'Wooden toy block', [.28 + (i % 3) * .14, .07 + Math.floor(i / 3) * .116, 1.50],
      [.117, .12, .12], [clay, blue, green][i % 3]!, 'matte').rotateY(i * .2)
  }
  box(sleeping, 'Bathroom floor', [3.26, .011, -2.60], [2.40, .028, 2.90], '#eef2f0', 'tile')
  box(sleeping, 'Bathroom side partition', [2.05, 1.33, -2.60], [.12, 2.66, 2.92], plaster, 'plaster')
  box(sleeping, 'Bathroom front partition', [2.58, 1.34, -1.15], [1.06, 2.68, .12], plaster, 'plaster')
  box(sleeping, 'Bathroom stair partition', [4.44, 1.34, -2.60], [.10, 2.68, 2.92], plaster, 'plaster')
  footprint(1, 2.05, -2.60, .12, 2.92)
  footprint(1, 2.58, -1.15, 1.06, .12)
  footprint(1, 4.44, -2.60, .10, 2.92)
  if (!placeExtra(sleeping, 'bathtub', 2.62, -2.95, { angle: Math.PI / 2 })) {
    box(sleeping, 'White bathtub base', [2.62, .15, -2.95], [.65, .29, 1.37], '#f3f0e8', 'ceramic')
    for (const side of [-1, 1]) {
      box(sleeping, 'White bathtub rim', [2.62 + side * .28, .40, -2.95], [.09, .23, 1.37], '#f3f0e8', 'ceramic')
      box(sleeping, 'White bathtub end', [2.62, .40, -2.95 + side * .64], [.48, .23, .09], '#f3f0e8', 'ceramic')
    }
  }
  box(sleeping, 'Bath mat', [3.32, .028, -2.85], [.48, .01, .76], '#d4ddd6', 'fabric')
  box(sleeping, 'Basin vanity', [3.75, .41, -3.72], [.62, .82, .52], oak, 'oak')
  box(sleeping, 'Ceramic basin', [3.75, .86, -3.72], [.64, .11, .53], '#f3f0e8', 'ceramic')
  box(sleeping, 'Bathroom mirror', [3.75, 1.53, -4.064], [.58, .66, .032], '#b3c6c5', 'ceramic')
  box(sleeping, 'Bath mirror light bar', [3.75, 1.90, -4.04], [.52, .04, .05], '#fff4db', 'lamp')
  box(sleeping, 'Folded towel', [3.90, .926, -3.60], [.22, .035, .19], green, 'fabric')
  mesh(sleeping, 'Toothbrush cup', cylGeo(.035, .030, .09, 12), [3.55, .955, -3.82], blue, 'ceramic')
  if (!placeExtra(sleeping, 'toilet', 2.55, -1.78, { angle: Math.PI / 2 })) {
    const toilet = mesh(sleeping, 'Porcelain toilet', sphGeo(1, 18, 10), [2.55, .30, -1.78], '#faf7ef', 'ceramic')
    toilet.scale.set(.23, .195, .28)
    box(sleeping, 'Toilet cistern', [2.41, .58, -1.78], [.19, .32, .40], '#faf7ef', 'ceramic')
  }
  footprint(1, 2.55, -1.78, .48, .58)
  footprint(1, 2.62, -2.95, .68, 1.40)
  footprint(1, 3.75, -3.72, .62, .53)
  const playCeiling = warm(1, 'Play room light', .85, 2.41, .60, 13)
  warm(1, 'Bath mirror light', 3.45, 2.43, -2.55, 12)

  const top = floors[2]!.root
  // 三楼阅读与工作区：书桌区与休闲单椅阅读角分区摆放，互不重叠
  if (!placeExtra(top, 'armchair', -2.35, -1.45, { angle: -.46, floorForSolid: 2 })) {
    furniture(2, 27, -2.35, -1.45, { scale: .92, angle: -.46, solid: true })
  }
  furniture(2, 28, -1.55, -1.65, { solid: true })
  furniture(2, 29, -1.55, -1.65, { y: .59 })
  furniture(2, 25, -2.25, -1.35)
  furniture(2, 40, 2.45, -3.55, { solid: true })
  furniture(2, 41, 2.45, -2.70, { solid: true })
  furniture(2, 11, 3.75, -3.55, { solid: true })
  furniture(2, 31, .25, -3.78, { angle: Math.PI / 2, scale: .80, solid: true })
  if (!placeExtra(top, 'sofa-2seat', -3.65, 3.55, { angle: Math.PI, floorForSolid: 2 })) {
    furniture(2, 24, -3.65, 3.55, { angle: Math.PI, solid: true })
  }
  furniture(2, 25, -3.65, 2.35, { scale: 1.18 })
  if (!placeExtra(top, 'coffee-table', -3.65, 1.85, { floorForSolid: 2 })) {
    furniture(2, 26, -3.65, 1.85, { solid: true })
  }
  furniture(2, 33, -1.65, 2.85, { scale: .94 })
  furniture(2, 18, -5.95, 3.25, { scale: .92 })
  // 复刻视频 0:19 工作角：开源 CC0 GLB 书桌 + 双屏显示器 + 键鼠 + 台灯 + 人体工学椅，搭配定制吊柜与通顶衣柜
  const glbDesk = placeExtra(top, 'desk', -4.45, -3.65, { floorForSolid: 2 })
  if (!glbDesk) {
    box(top, 'Study desk top', [-4.45, .74, -3.65], [1.45, .045, .62], oak, 'oak')
    box(top, 'Study desk drawer base', [-5.02, .37, -3.65], [.32, .72, .56], '#f3f1ec', 'plaster')
    box(top, 'Study desk leg', [-3.78, .37, -3.65], [.06, .74, .52], frame, 'metal')
    footprint(2, -4.45, -3.65, 1.45, .62)
  }
  box(top, 'Study desk return', [-3.68, .73, -3.08], [.54, .04, 1.18], oak, 'oak')
  // 顶部白色吊柜（4格分缝 + 黑色拉手）
  for (let i = 0; i < 4; i++) {
    const cx = -5.05 + i * .56
    box(top, 'Study overhead cabinet', [cx, 2.26, -3.86], [.54, .68, .36], '#f3f1ec', 'plaster')
    box(top, 'Study cabinet handle', [cx + .18, 2.08, -3.67], [.018, .11, .018], '#2b2d30', 'metal')
  }
  // 左侧通顶衣柜（3门 + 黑色长拉手）
  for (let i = 0; i < 3; i++) {
    const wz = -2.85 + i * .58
    box(top, 'Tall wardrobe door', [-6.42, 1.28, wz], [.42, 2.52, .56], '#f3f1ec', 'plaster')
    box(top, 'Wardrobe bar handle', [-6.20, 1.22, wz + .18], [.018, .42, .018], '#2b2d30', 'metal')
  }
  footprint(2, -6.42, -2.27, .44, 1.76)
  // 开源 CC0 双屏显示器 + 键鼠 + 桌面灯
  if (!placeExtra(top, 'dual-monitors', -4.45, -3.79, { y: .74, scale: 1.08 })) {
    box(top, 'Main monitor frame', [-4.68, 1.02, -3.77], [.58, .35, .025], '#2a2d30', 'metal')
    box(top, 'Main monitor screen', [-4.68, 1.02, -3.755], [.54, .31, .008], '#eef3f5', 'screen')
  }
  if (!placeExtra(top, 'keyboard-mouse', -4.45, -3.53, { y: .74, scale: .92 })) {
    box(top, 'Keyboard', [-4.52, .768, -3.54], [.32, .014, .11], '#2e3136', 'metal')
  }
  placeExtra(top, 'desk-lamp', -4.96, -3.70, { y: .74, angle: .35 })
  mesh(top, 'Desk teal mug', cylGeo(.04, .036, .09, 12), [-3.96, .81, -3.55], '#65a6ad', 'ceramic')
  for (const [i, col] of ['#c8534b', '#5280a8', '#68996e', '#eae6dc'].entries()) {
    box(top, 'Desk book', [-3.68, .86, -2.86 + i * .055], [.18, .24, .042], col, 'matte')
  }
  if (!placeExtra(top, 'ergo-chair', -4.45, -2.80, { angle: Math.PI, floorForSolid: 2 })) {
    box(top, 'Ergo chair seat', [-4.45, .46, -2.80], [.46, .08, .44], '#787d82', 'fabric')
    box(top, 'Ergo chair back', [-4.45, .82, -2.58], [.42, .56, .08], '#787d82', 'fabric')
  }
  box(top, 'Loft rug', [-3.65, .008, 2.35], [3.20, .012, 2.20], '#e3dacb', 'fabric')
  placeExtra(top, 'bookshelf', -2.35, -3.82, { floorForSolid: 2 })
  placeExtra(top, 'floor-lamp', -5.95, 2.05, { floorForSolid: 2 })
  box(top, 'Loft pillow', [-4.15, .56, 3.49], [.32, .28, .14], green, 'fabric').rotateZ(-.12)
  box(top, 'Loft pillow', [-3.05, .56, 3.49], [.32, .28, .14], clay, 'fabric').rotateZ(.15)
  contactShadow(top, -3.65, 1.85, 1.45, .90)
  plant(top, 3.65, 3.15, 1.42)
  plant(top, -5.85, -.25, 1.0)
  for (const [i, color] of [clay, blue, green].entries()) {
    box(top, 'Sketchbook', [2.18 + i * .015, .77 + i * .022, -3.55], [.26, .021, .20], color, 'matte').rotateY(i * .16)
  }
  box(top, 'Paint palette', [2.62, .77, -3.50], [.22, .016, .16], '#f3ede0', 'oak')
  mesh(top, 'Brush jar', cylGeo(.04, .038, .10, 10), [2.82, .81, -3.62], blue, 'ceramic')
  picture(top, -.95, 1.79, -4.064, blue, .54)
  picture(top, -1.70, 1.69, -4.064, clay, .49)
  cups(top, -3.73, .456, 1.91)
  mesh(top, 'Reading lamp shade', cylGeo(.11, .15, .17, 14), [-1.55, .94, -1.65], '#fff2d8', 'lamp')
  const reading = warm(2, 'Reading lamp glow', -1.55, .94, -1.65, 5.7)
  warm(2, 'Loft warm light', -3.20, 2.43, 2.05, 14)
  warm(2, 'Workshop warm light', 2.05, 2.41, -2.25, 12)

  // 四层：星空露台与空中花房（floors[3]）
  const terrace = floors[3]!.root
  box(terrace, 'Terrace wood deck', [-3.20, .014, .85], [4.60, .026, 4.00], '#c6a277', 'oak')
  box(terrace, 'Terrace outdoor sofa', [-3.45, .24, 2.05], [1.75, .42, .82], '#e5dfd1', 'fabric')
  box(terrace, 'Terrace sofa back', [-3.45, .54, 2.40], [1.75, .48, .16], '#d8d1c2', 'fabric')
  box(terrace, 'Terrace pillow', [-3.95, .56, 2.18], [.34, .28, .14], clay, 'fabric').rotateZ(.15)
  box(terrace, 'Terrace pillow', [-2.95, .56, 2.18], [.34, .28, .14], blue, 'fabric').rotateZ(-.14)
  footprint(3, -3.45, 2.05, 1.80, .92)
  if (!placeExtra(terrace, 'patio-table', -3.35, .35, { y: .02, scale: .92, floorForSolid: 3 })) {
    mesh(terrace, 'Terrace round table', cylGeo(.46, .46, .04, 18), [-3.35, .44, .35], oak, 'oak')
    mesh(terrace, 'Terrace table leg', cylGeo(.06, .16, .42, 12), [-3.35, .21, .35], frame, 'metal')
    footprint(3, -3.35, .35, .96, .96)
    cups(terrace, -3.43, .46, .37)
  }
  contactShadow(terrace, -3.45, 2.05, 1.9, 1.0)
  contactShadow(terrace, -3.35, .35, 1.2, 1.2)
  // 空中花房花箱 + 绿植 + 观星望远镜
  box(terrace, 'Garden planter box', [2.10, .26, -3.35], [2.40, .52, .72], '#b98f66', 'oak')
  footprint(3, 2.10, -3.35, 2.44, .76)
  for (const x of [1.30, 2.10, 2.90]) plant(terrace, x, -3.35, .98, .52)
  plant(terrace, -5.85, -3.25, 1.35)
  plant(terrace, -5.85, 3.25, 1.18)
  const scopeTube = mesh(propsGroup, 'Telescope tube', cylGeo(.045, .065, .72, 12), [-5.55, 3 * floorRise + 1.18, -1.25], '#e9e5dc', 'metal')
  scopeTube.rotation.set(Math.PI / 3, .45, 0)
  mesh(terrace, 'Telescope tripod', cylGeo(.03, .26, .95, 6), [-5.55, .48, -1.25], frame, 'metal')
  footprint(3, -5.55, -1.25, .60, .60)
  // 露台暖光串灯
  for (let i = 0; i < 8; i++) {
    mesh(terrace, 'String light bulb', sphGeo(.048, 10, 8), [-5.6 + i * 1.10, 1.24, -4.04], '#ffe8b8', 'lamp')
    mesh(terrace, 'String light bulb', sphGeo(.048, 10, 8), [-5.6 + i * 1.10, 1.24, 4.04], '#ffe8b8', 'lamp')
  }
  const terraceLounge = warm(3, 'Terrace lounge light', -3.35, 1.85, 1.15, 14)
  warm(3, 'Terrace garden light', 2.05, 1.85, -2.55, 12)

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

  // 夜晚星空与弯月（夜景模式下显形）
  const skyGroup = new Group()
  skyGroup.name = 'Night sky stars'
  skyGroup.visible = false
  house.add(skyGroup)
  const starCount = 260
  const starPositions = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i++) {
    const angle = (i * 2.39996) % (Math.PI * 2)
    const radius = 14 + (i % 19) * .85
    starPositions[i * 3] = Math.cos(angle) * radius
    starPositions[i * 3 + 1] = 13 + (i % 13) * .95
    starPositions[i * 3 + 2] = Math.sin(angle) * radius
  }
  const starGeo = new BufferGeometry()
  starGeo.setAttribute('position', new BufferAttribute(starPositions, 3))
  const starMat = new PointsMaterial({ color: '#fff3d4', size: .24, transparent: true, opacity: .88, sizeAttenuation: true })
  skyGroup.add(new Points(starGeo, starMat))
  const moonMesh = new Mesh(sphGeo(.62, 16, 12), new MeshBasicMaterial({ color: '#fff4d6' }))
  moonMesh.position.set(-7.5, 17.5, -14.5)
  skyGroup.add(moonMesh)

  // 交互式家具与生活道具（按 E 触发实时 3D 动效）
  const tvCanvas = document.createElement('canvas')
  tvCanvas.width = 160
  tvCanvas.height = 90
  const tvCtx = tvCanvas.getContext('2d')!
  const tvTex = new CanvasTexture(tvCanvas)
  tvTex.colorSpace = SRGBColorSpace
  let lastTvDraw = -1000
  const tvScreenMat = new MeshStandardMaterial({
    map: tvTex, emissiveMap: tvTex, emissive: '#ffffff', emissiveIntensity: 0, roughness: .18,
  })
  const tvScreen = new Mesh(boxGeo(1.02, .56, .016), tvScreenMat)
  tvScreen.position.set(-3.95, 1.06, 3.55)
  tvScreen.visible = false
  propsGroup.add(tvScreen)
  const tvGlow = new PointLight('#8bc8f5', 0, 4.8, 2)
  tvGlow.position.set(-3.95, 1.08, 3.20)
  floors[0]!.root.add(tvGlow)

  const coffeeLedMat = new MeshStandardMaterial({
    color: '#3a2e28', emissive: '#ff9a44', emissiveIntensity: 0, roughness: .35,
  })
  const coffeeLed = new Mesh(sphGeo(.026, 8, 6), coffeeLedMat)
  coffeeLed.position.set(-.45, 1.24, -3.58)
  coffeeLed.visible = false
  propsGroup.add(coffeeLed)
  const steamMat = new MeshBasicMaterial({ color: '#f9f6f0', transparent: true, opacity: .45, depthWrite: false })
  const coffeeSteams = [0, 1, 2].map(() => {
    const puff = new Mesh(sphGeo(.032, 8, 6), steamMat)
    puff.visible = false
    propsGroup.add(puff)
    return puff
  })

  const waterMat = new MeshStandardMaterial({
    color: '#a8d8ea', emissive: '#9bd2e8', emissiveIntensity: .25, roughness: .12, transparent: true, opacity: .76,
  })
  const waterStream = new Mesh(cylGeo(.012, .016, .22, 10), waterMat)
  waterStream.position.set(.25, 1.06, -3.76)
  waterStream.visible = false
  propsGroup.add(waterStream)
  const sinkRipple = new Mesh(cylGeo(.14, .14, .006, 16), waterMat)
  sinkRipple.position.set(.25, .958, -3.74)
  sinkRipple.visible = false
  propsGroup.add(sinkRipple)
  const tapLever = new Mesh(boxGeo(.02, .06, .02), material('#8a9492', 'metal'))
  tapLever.position.set(.25, 1.19, -3.86)
  propsGroup.add(tapLever)

  const pcCanvas = document.createElement('canvas')
  pcCanvas.width = pcCanvas.height = 256
  const pcCtx = pcCanvas.getContext('2d')!
  const pcTex = new CanvasTexture(pcCanvas)
  pcTex.colorSpace = SRGBColorSpace
  let lastPcDraw = -1000
  function drawPcScreen(t: number) {
    const s = 256
    pcCtx.fillStyle = '#1b222c'
    pcCtx.fillRect(0, 0, s, s)
    pcCtx.fillStyle = '#25303f'
    pcCtx.fillRect(8, 12, s * .42, s - 24)
    pcCtx.fillRect(s * .52, 12, s * .42, s - 24)
    const cols = ['#7dd3fc', '#a7f3d0', '#fca5a5', '#fde68a']
    const shift = Math.floor(t * 2) % 12
    for (let i = 0; i < 12; i++) {
      pcCtx.fillStyle = cols[(i + shift) % cols.length]!
      const w1 = 36 + ((i * 23 + shift * 11) % 56)
      const w2 = 34 + ((i * 19 + shift * 7) % 56)
      pcCtx.fillRect(18, 28 + i * 16, w1, 6)
      pcCtx.fillRect(s * .55, 28 + i * 16, w2, 6)
    }
    pcTex.needsUpdate = true
  }
  drawPcScreen(0)
  const pcGlowMat = new MeshStandardMaterial({
    map: pcTex, emissiveMap: pcTex, emissive: '#d8f0ff', emissiveIntensity: 0, roughness: .22,
  })
  const pcScreen = new Mesh(boxGeo(.82, .30, .014), pcGlowMat)
  pcScreen.position.set(-4.45, 1.06, -3.72)
  pcScreen.visible = false
  propsGroup.add(pcScreen)
  const deskLampGlow = new PointLight('#ffd8a8', 0, 3.4, 2)
  deskLampGlow.position.set(-4.85, 1.18, -3.65)
  floors[0]!.root.add(deskLampGlow)

  const fridgeLight = new PointLight('#dff4ff', 0, 2.8, 2)
  fridgeLight.position.set(3.85, 1.15, -3.20)
  floors[0]!.root.add(fridgeLight)
  const fridgeStripMat = new MeshBasicMaterial({ color: '#e6f7ff' })
  const fridgeStrip = new Mesh(boxGeo(.03, 1.25, .02), fridgeStripMat)
  fridgeStrip.position.set(3.85, .95, -3.35)
  fridgeStrip.visible = false
  propsGroup.add(fridgeStrip)
  const fridgeMistMat = new MeshBasicMaterial({ color: '#dff4ff', transparent: true, opacity: .36, depthWrite: false })
  const fridgeMists = [0, 1, 2].map(() => {
    const puff = new Mesh(sphGeo(.05, 8, 6), fridgeMistMat)
    puff.visible = false
    propsGroup.add(puff)
    return puff
  })

  const microLight = new PointLight('#ffba66', 0, 2.0, 2)
  microLight.position.set(2.65, 1.15, -3.50)
  floors[0]!.root.add(microLight)
  const microWindowMat = new MeshBasicMaterial({ color: '#ffcb77', transparent: true, opacity: .78 })
  const microWindow = new Mesh(boxGeo(.28, .16, .015), microWindowMat)
  microWindow.position.set(2.65, 1.09, -3.56)
  microWindow.visible = false
  propsGroup.add(microWindow)
  const microTurntable = new Group()
  microTurntable.position.set(2.65, 1.03, -3.62)
  microTurntable.visible = false
  propsGroup.add(microTurntable)
  microTurntable.add(new Mesh(cylGeo(.08, .08, .012, 12), material('#e6eef2', 'ceramic')))
  const microBowl = new Mesh(cylGeo(.045, .035, .035, 10), material('#f5ebe0', 'ceramic'))
  microBowl.position.set(.02, .022, 0)
  microTurntable.add(microBowl)

  const bathWaterMat = new MeshStandardMaterial({
    color: '#a3d8e6', roughness: .08, metalness: .05, transparent: true, opacity: .74,
  })
  const bathWater = new Mesh(boxGeo(.52, .04, 1.14), bathWaterMat)
  bathWater.position.set(2.62, floorRise + .16, -2.95)
  bathWater.visible = false
  propsGroup.add(bathWater)
  const bathSteams = [0, 1, 2].map(() => {
    const puff = new Mesh(sphGeo(.055, 8, 6), steamMat)
    puff.visible = false
    propsGroup.add(puff)
    return puff
  })
  const bathBubbles = [0, 1, 2, 3].map(() => {
    const bubble = new Mesh(sphGeo(.024, 8, 6), fridgeMistMat)
    bubble.visible = false
    propsGroup.add(bubble)
    return bubble
  })

  // 书架互动高亮书本
  const shelfHighlightMat = new MeshStandardMaterial({
    color: '#e0b44f', emissive: '#e0b44f', emissiveIntensity: .35, roughness: .35,
  })
  const shelfHighlightBook = new Mesh(boxGeo(.16, .24, .05), shelfHighlightMat)
  shelfHighlightBook.position.set(-1.60, 1.02, 2.78)
  propsGroup.add(shelfHighlightBook)

  const kibbleMound = new Mesh(sphGeo(.08, 10, 6), material('#7a5338', 'matte'))
  kibbleMound.scale.set(1.2, .45, 1.2)
  kibbleMound.position.set(-1.45, .06, 1.35)
  kibbleMound.visible = false
  propsGroup.add(kibbleMound)
  let kibblePopAt = 0

  const props: HouseProp[] = [
    {
      id: 'living-tv', label: '打开客厅电视', offLabel: '关掉客厅电视', shortLabel: '📺 电视',
      floor: 0, x: -3.95, z: 3.72, kind: 'tv',
      update(active, time) {
        tvScreen.visible = active
        if (active) {
          if (time - lastTvDraw > 75) {
            lastTvDraw = time
            const t = time * .0012
            const grad = tvCtx.createLinearGradient(0, 0, 160, 90)
            grad.addColorStop(0, `hsl(${(t * 24) % 360}, 58%, 42%)`)
            grad.addColorStop(.5, `hsl(${(t * 24 + 55) % 360}, 64%, 52%)`)
            grad.addColorStop(1, `hsl(${(t * 24 + 120) % 360}, 52%, 34%)`)
            tvCtx.fillStyle = grad
            tvCtx.fillRect(0, 0, 160, 90)
            tvCtx.fillStyle = 'rgba(255,255,255,0.28)'
            tvCtx.beginPath()
            tvCtx.arc(80 + Math.sin(t) * 32, 38 + Math.cos(t * 1.3) * 12, 16, 0, Math.PI * 2)
            tvCtx.fill()
            tvCtx.fillStyle = 'rgba(20, 32, 46, 0.45)'
            tvCtx.fillRect(0, 66, 160, 24)
            tvTex.needsUpdate = true
          }
          tvScreenMat.emissiveIntensity = .95
          tvGlow.intensity = 3.6 + Math.sin(time * .005) * .6
        } else {
          tvScreenMat.emissiveIntensity = 0
          tvGlow.intensity = 0
        }
      },
    },
    {
      id: 'kitchen-coffee', label: '冲泡热美式咖啡', offLabel: '停止咖啡机', shortLabel: '☕ 咖啡机',
      floor: 0, x: -.45, z: -3.72, kind: 'coffee',
      update(active, time) {
        coffeeLed.visible = active
        coffeeLedMat.emissiveIntensity = active ? 1.4 : 0
        coffeeSteams.forEach((puff, idx) => {
          puff.visible = active
          if (!active) return
          const cycle = ((time * .00075) + idx * .33) % 1
          puff.position.set(-.45 + Math.sin(cycle * 6 + idx) * .03, 1.32 + cycle * .34, -3.70)
          puff.scale.setScalar(.7 + cycle * .9)
        })
      },
    },
    {
      id: 'kitchen-tap', label: '打开厨房水龙头', offLabel: '关掉厨房水龙头', shortLabel: '💧 水龙头',
      floor: 0, x: .25, z: -3.70, kind: 'tap',
      update(active, time) {
        waterStream.visible = active
        sinkRipple.visible = active
        tapLever.rotation.z = active ? -.45 : 0
        if (active) {
          const shimmer = 1 + Math.sin(time * .028) * .14
          waterStream.scale.set(shimmer, 1, shimmer)
          const rPhase = (time * .0024) % 1
          const rScale = .35 + rPhase * .95
          sinkRipple.scale.set(rScale, 1, rScale)
        }
      },
    },
    {
      id: 'study-pc', label: '打开电脑 · 日记编辑', offLabel: '打开电脑 · 日记编辑', shortLabel: '💻 双屏电脑',
      floor: 0, x: -4.45, z: -3.65, kind: 'pc',
      update(active, time) {
        pcScreen.visible = active
        if (active && time - lastPcDraw > 180) {
          lastPcDraw = time
          drawPcScreen(time * .001)
        }
        pcGlowMat.emissiveIntensity = active ? (.95 + Math.sin(time * .004) * .12) : 0
        deskLampGlow.intensity = active ? (4.2 + Math.sin(time * .003) * .45) : 0
      },
    },
    {
      id: 'kitchen-fridge', label: '打开冰箱冷灯', offLabel: '关上冰箱', shortLabel: '🧊 冰箱',
      floor: 0, x: 3.85, z: -3.68, kind: 'fridge',
      update(active, time) {
        fridgeStrip.visible = active
        fridgeLight.intensity = active ? (3.6 + Math.sin(time * .005) * .35) : 0
        fridgeMists.forEach((puff, idx) => {
          puff.visible = active
          if (!active) return
          const cycle = ((time * .0006) + idx * .33) % 1
          puff.position.set(3.85 + Math.sin(cycle * 5 + idx) * .08, 1.25 - cycle * .75, -3.28 + cycle * .16)
          puff.scale.setScalar(.65 + cycle * .85)
        })
      },
    },
    {
      id: 'kitchen-microwave', label: '微波炉加热', offLabel: '停止微波炉', shortLabel: '🍽 微波炉',
      floor: 0, x: 2.65, z: -3.72, kind: 'microwave',
      update(active, time) {
        microWindow.visible = active
        microTurntable.visible = active
        if (active) microTurntable.rotation.y = time * .0022
        microLight.intensity = active ? (3.2 + Math.sin(time * .018) * .5) : 0
      },
    },
    {
      id: 'pet-feed', label: '给小柴加狗粮', offLabel: '清理空食盆', shortLabel: '🦴 已加粮',
      floor: 0, x: -1.45, z: 1.35, kind: 'pet-feed',
      update(active, time) {
        if (active && !kibbleMound.visible) kibblePopAt = time
        kibbleMound.visible = active
        if (active) {
          const dt = Math.min(1, (time - kibblePopAt) / 360)
          const bounce = 1 + Math.sin(dt * Math.PI) * .24
          kibbleMound.scale.set(1.2 * bounce, .45 * dt, 1.2 * bounce)
        }
      },
    },
    {
      id: 'bath-tub', label: '放一池热水澡', offLabel: '排空浴缸热水', shortLabel: '🛁 泡澡水',
      floor: 1, x: 2.62, z: -2.95, kind: 'bathtub',
      update(active, time) {
        bathWater.visible = active
        if (active) bathWater.position.y = floorRise + .28 + Math.sin(time * .003) * .012
        bathSteams.forEach((puff, idx) => {
          puff.visible = active
          if (!active) return
          const cycle = ((time * .00048) + idx * .33) % 1
          puff.position.set(2.55 + Math.sin(cycle * 5 + idx) * .09, floorRise + .42 + cycle * .55, -2.95 + (idx - 1) * .25)
          puff.scale.setScalar(.8 + cycle * 1.1)
        })
        bathBubbles.forEach((bubble, idx) => {
          bubble.visible = active
          if (!active) return
          const cycle = ((time * .0009) + idx * .25) % 1
          bubble.position.set(2.52 + Math.cos(idx * 2 + time * .002) * .12, floorRise + .30 + cycle * .38, -2.95 + (idx - 1.5) * .22)
          bubble.scale.setScalar(.55 + Math.sin(cycle * Math.PI) * .75)
        })
      },
    },
    {
      id: 'terrace-scope', label: '用望远镜观星', offLabel: '退出观星视角', shortLabel: '🔭 观星中',
      floor: 3, x: -5.55, z: -1.25, kind: 'telescope',
      update(active, time) {
        scopeTube.rotation.y = active ? .45 + Math.sin(time * .0011) * .35 : .45 + Math.sin(time * .0004) * .08
        scopeTube.rotation.x = active ? Math.PI / 3 + Math.sin(time * .0008) * .07 : Math.PI / 3
      },
    },
    {
      id: 'study-journal-shelf', label: '翻阅工作间日记书架', offLabel: '翻阅工作间日记书架', shortLabel: '📖 日记书架',
      floor: 0, x: -6.38, z: -2.10, kind: 'journal',
      update(active, time) {
        shelfHighlightBook.position.x = -1.60 + (active ? .07 : Math.sin(time * .0025) * .015)
        shelfHighlightMat.emissiveIntensity = active ? .75 : (.25 + Math.sin(time * .003) * .12)
      },
    },
    {
      id: 'living-journal-shelf', label: '浏览客厅日记展示架', offLabel: '浏览客厅日记展示架', shortLabel: '📖 日记展示架',
      floor: 0, x: -1.60, z: 2.85, kind: 'journal',
      update(active, time) {
        shelfHighlightBook.position.x = -1.60 + (active ? .07 : Math.sin(time * .0025) * .015)
        shelfHighlightMat.emissiveIntensity = active ? .75 : (.25 + Math.sin(time * .003) * .12)
      },
    },
  ]

  // 根据真实日记条数在客厅展示架上动态摆放彩色书脊（星标日记为金色书脊）
  const diaryBooksGroup = new Group()
  diaryBooksGroup.name = 'Dynamic diary books'
  propsGroup.add(diaryBooksGroup)
  const bookPalette = ['#6ab399', '#e2946d', '#6d8fb3', '#e5c16c', '#b4879f', '#527966']
  function syncJournalBooks(totalEntries: number, starredEntries: number) {
    while (diaryBooksGroup.children.length) diaryBooksGroup.remove(diaryBooksGroup.children[0]!)
    const visibleBooks = Math.min(18, Math.max(3, totalEntries))
    const goldCount = Math.min(visibleBooks, starredEntries)
    for (let i = 0; i < visibleBooks; i++) {
      const shelfRow = Math.floor(i / 6)
      const col = i % 6
      const y = .46 + shelfRow * .36
      const z = 2.52 + col * .12
      const isGold = i < goldCount
      const h = .20 + (i % 3) * .025
      const spine = new Mesh(
        boxGeo(.16, h, .045),
        material(isGold ? '#e0b44f' : bookPalette[i % bookPalette.length]!, isGold ? 'metal' : 'matte'),
      )
      spine.position.set(-1.60, y + h / 2, z)
      diaryBooksGroup.add(spine)
    }
  }
  syncJournalBooks(3, 1)

  const seats: HouseSeat[] = [
    { id: 'living-sofa', label: '客厅沙发', floor: 0, x: -3.95, z: .72, seatX: -3.95, seatZ: .92, eyeY: 1.12, look: [-3.95, 3.72] },
    { id: 'study-chair', label: '工作椅', floor: 0, x: -4.45, z: -2.85, seatX: -4.45, seatZ: -2.92, eyeY: 1.14, look: [-4.45, -3.79] },
    { id: 'dining-chair', label: '餐椅', floor: 0, x: 1.25, z: 1.15, seatX: 1.25, seatZ: 1.12, eyeY: 1.12, look: [1.25, .45] },
    { id: 'master-bed', label: '主卧大床', floor: 1, x: -4.05, z: -1.65, seatX: -4.05, seatZ: -1.55, eyeY: .94, look: [-4.05, -4.05] },
    { id: 'loft-sofa', label: '阁楼沙发', floor: 2, x: -3.65, z: 3.55, seatX: -3.65, seatZ: 3.35, eyeY: 1.12, look: [-3.65, 1.85] },
    { id: 'terrace-sofa', label: '露台沙发', floor: 3, x: -3.45, z: 2.05, seatX: -3.45, seatZ: 1.92, eyeY: 1.12, look: [-3.45, -2.5] },
  ]

  const localLamps = [
    { id: 'living-ceiling', label: '客厅主灯', floor: 0, x: -3.95, z: 1.65, light: livingCeiling },
    { id: 'dining-pendant', label: '餐厅吊灯', floor: 0, x: 1.25, z: .45, light: diningPendant },
    { id: 'study-ceiling', label: '工作间顶灯', floor: 0, x: -4.30, z: -2.20, light: studyCeiling },
    { id: 'bedside', label: '床头灯', floor: 1, x: -2.55, z: -2.65, light: bedside },
    { id: 'play-ceiling', label: '儿童房灯', floor: 1, x: .85, z: .60, light: playCeiling },
    { id: 'reading', label: '阅读灯', floor: 2, x: -1.55, z: -1.65, light: reading },
    { id: 'terrace-lounge', label: '露台氛围灯', floor: 3, x: -3.35, z: 1.15, light: terraceLounge },
  ]
  return { house, ground, roof, propsGroup, skyGroup, clockHands, floors, doors, localLamps, seats, props, emissiveMaterials, pet, syncJournalBooks }
}

export const sceneBackdrop = new Color('#dde5e3')
