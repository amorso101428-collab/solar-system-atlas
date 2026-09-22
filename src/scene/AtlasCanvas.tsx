import { Suspense } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { StarField } from './StarField'
import { IntroCosmos } from './IntroCosmos'
import { Sun } from './Sun'
import { Planets } from './Planets'
import { Orbits } from './Orbits'
import { Objects } from './Objects'
import { CameraRig } from './CameraRig'
import { OverlayBridge } from './OverlayBridge'
import { EarthCatalog } from './EarthCatalog'
import { FocusHalo } from './FocusHalo'
import { PostFX } from './PostFX'
import { EclipticGrid } from './EclipticGrid'
import { HoloBridge } from './HoloBridge'
import { Comets } from './Comets'
import { useAtlasStore } from '../state/atlasStore'
import { glStats } from '../utils/glStats'
import { PERF_MAX_DPR } from '../utils/perf'
import { PerfGovernor } from './PerfGovernor'
import { FrameProfiler } from './FrameProfiler'

/**
 * 3D 层只负责空间与镜头；UI 全部在 DOM 里（DESIGN.md §20 的分层原则）。
 *
 * 用的是正交相机：这张"工程图"的侧视构图必须是平的，
 * 可见高度通过 camera.top/bottom 控制，因此旋转平移不会引入透视变形。
 */
export function AtlasCanvas() {
  const mode = useAtlasStore((state) => state.mode)
  const inIntro = mode === 'INTRO'

  return (
    <div className="canvas-layer">
      <Canvas
        dpr={[1, PERF_MAX_DPR]}
        gl={{ antialias: false, powerPreference: 'high-performance', alpha: false }}
        orthographic
        camera={{ position: [72, 0, 900], near: 1, far: 4000, zoom: 1, top: 44, bottom: -44, left: -78, right: 78 }}
        onCreated={({ gl, scene }) => {
          gl.setClearColor('#04040a')
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.0
          // v9 §23：把渲染器交给遥测 HUD（读 renderer.info 与 GPU 字符串）
          glStats.renderer = gl
          // v9.4：显存估算要遍历场景
          glStats.scene = scene
        }}
      >
        <color attach="background" args={['#04040a']} />
        <Suspense fallback={null}>
          <StarField />
          {/*
            v7.2：图谱层在开场时**照常渲染**，不再 visible={false}。

            两个理由：
              1. 主页背景必须就是图谱本身（同一颗太阳、同一批轨道），
                 进入时才有"从这片宇宙退出来"的连续感，而不是两套画面切换；
              2. 行星贴图在这一帧就上传完 GPU，点"进入图谱"不会卡一下。
            开场与图谱的差别只由 camera（1.82 倍拉近）与各图层的透明度表达，
            见 utils/reveal.ts。
          */}
          <group name="atlas-stage">
            <Sun />
            <EclipticGrid />
            <Planets />
            <Comets />
            <Orbits />
            <Objects />
            <EarthCatalog />
            <FocusHalo />
          </group>
          <IntroCosmos visible={inIntro} />
          {/* v9.3：按实测帧率自动调整渲染分辨率（核显机器上救帧率） */}
          <PerfGovernor />
          {/* v9.4：主线程耗时采样（HUD 的 CPU 一栏） */}
          <FrameProfiler />
          <CameraRig />
          <OverlayBridge />
          <HoloBridge />
          <PostFX />
        </Suspense>
      </Canvas>
    </div>
  )
}
