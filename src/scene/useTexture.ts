import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { adaptiveQuality } from '../performance/AdaptiveQualityManager'
import { deviceClassOf, getLayoutMode } from '../responsive/device'

/**
 * 贴图加载：全部来自 public/ 下的真实素材（NASA / Solar System Scope）。
 * 加载失败时静默返回 null，着色器会退回程序化渲染，而不是把画面画崩。
 *
 * V1.1 §12 / §18：贴图过滤（各向异性 / mipmap）也是降级阶梯的一级。
 * 这里维护一份已加载贴图的登记表，换档时**就地**改参数，
 * 不重新加载、不 dispose —— 所以不会出现"聚焦几次之后显存越吃越多"。
 */

const loaded = new Set<THREE.Texture>()

/**
 * 贴图分级（V1.1 §18 / §19）。
 *
 * 20 张 2048×1024 的等距圆柱贴图带 mipmap 大约是 220 MB 显存——
 * 桌面无所谓，手机上足够把 WebGL 上下文顶掉。所以 `tools/make-texture-tiers.ps1`
 * 预先产出 `-1k` / `-512` 两档（仓库多 5 MB），这里**在加载时**挑一档：
 *
 *   桌面 / 平板   → 原图 2k
 *   手机          → -1k（显存降到 1/4）
 *   画质 LOW/SAFE → -512（再降到 1/16）
 *
 * 分级只在**加载那一刻**决定：中途降档不会重新拉一遍贴图
 * （那会带来一次网络请求 + 上传卡顿），降档后新加载的贴图才用新档。
 * 找不到分级图时自动回退原图，绝不会因为少一张素材而变黑。
 */
export function textureTierSuffix(): '' | '-1k' | '-512' {
  const level = adaptiveQuality.level
  if (level === 'LOW' || level === 'SAFE') return '-512'
  return deviceClassOf(getLayoutMode()) === 'mobile' ? '-1k' : ''
}

function tierUrlOf(url: string, suffix: string): string | null {
  if (!suffix) return null
  const match = /^(.*?)(-2k)?(\.[a-z]+)$/i.exec(url)
  if (!match) return null
  return `${match[1]}${suffix}${match[3]}`
}

function applyQualityTo(texture: THREE.Texture): void {
  const settings = adaptiveQuality.settings
  const anisotropy = settings.textureAnisotropy
  const mipmaps = settings.textureMipmaps
  if (
    texture.anisotropy === anisotropy &&
    texture.generateMipmaps === mipmaps
  ) {
    return
  }
  texture.anisotropy = anisotropy
  texture.generateMipmaps = mipmaps
  texture.minFilter = mipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter
  texture.needsUpdate = true
}

export function applyTextureQuality(): void {
  loaded.forEach(applyQualityTo)
}

let textureQualityBound = false
function bindTextureQuality(): void {
  if (textureQualityBound) return
  textureQualityBound = true
  adaptiveQuality.subscribe(applyTextureQuality)
}

export function useTexture(url: string | null): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    bindTextureQuality()
    if (!url) {
      setTexture(null)
      return
    }
    let cancelled = false
    const path = url.startsWith('/') || url.startsWith('http') ? url : `/${url}`
    const loader = new THREE.TextureLoader()
    const accept = (tex: THREE.Texture) => {
      if (cancelled) {
        tex.dispose()
        return
      }
      tex.colorSpace = THREE.SRGBColorSpace
      applyQualityTo(tex)
      loaded.add(tex)
      setTexture(tex)
    }
    const giveUp = () => setTexture(null)
    /** 先试分级图，404 再回退原图 */
    const tier = tierUrlOf(path, textureTierSuffix())
    const loadOriginal = () => loader.load(path, accept, undefined, giveUp)
    if (tier) loader.load(tier, accept, undefined, loadOriginal)
    else loadOriginal()
    return () => {
      cancelled = true
    }
  }, [url])

  return texture
}
