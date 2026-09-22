import { useEffect, useState } from 'react'
import * as THREE from 'three'

/**
 * 贴图加载：全部来自 public/ 下的真实素材（NASA / Solar System Scope）。
 * 加载失败时静默返回 null，着色器会退回程序化渲染，而不是把画面画崩。
 */
export function useTexture(url: string | null): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    if (!url) {
      setTexture(null)
      return
    }
    let cancelled = false
    const path = url.startsWith('/') || url.startsWith('http') ? url : `/${url}`
    new THREE.TextureLoader().load(
      path,
      (tex) => {
        if (cancelled) {
          tex.dispose()
          return
        }
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = 8
        tex.generateMipmaps = true
        tex.minFilter = THREE.LinearMipmapLinearFilter
        setTexture(tex)
      },
      undefined,
      () => setTexture(null)
    )
    return () => {
      cancelled = true
    }
  }, [url])

  return texture
}
