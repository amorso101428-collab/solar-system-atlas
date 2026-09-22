import * as THREE from 'three'

/**
 * 轨道线材质。
 *
 * 这一版删掉了"沿轨道跑的能量头"——那个固定高光在整张图上同时出现几十次，
 * 是画面杂乱的主要来源（方案书 §11）。现在线只有颜色、粗细与透明度，
 * 亮度不再固定贴在轨道的某个位置。
 *
 * 同时每圈轨道留一个"开口"：开口正好落在它自己的天体/航天器所在的角度上，
 * 于是那颗天体读起来是"挂在自己轨道的开口里"，而不是浮在轨道旁边（方案书 §12）。
 * 开口位置由 aGapPhase / aGapSpeed 给出，随天体一起沿轨道走。
 */
export function createOrbitMaterial(color: string, opacity: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute float aProgress;
      attribute float aGapPhase;
      attribute float aGapSpeed;
      varying float vProgress;
      varying float vFade;
      varying float vGap;
      uniform float uTime;
      uniform float uGapSpan;
      uniform float uGapEnabled;
      void main(){
        vProgress = aProgress;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // 轨道弧线在远侧稍微淡出，制造纵深
        vFade = 0.75 + 0.25 * clamp(-mv.z / 200.0 + 0.5, 0.0, 1.0);
        float head = fract(aGapPhase + uTime * aGapSpeed);
        float d = abs(aProgress - head);
        d = min(d, 1.0 - d);
        float gap = smoothstep(uGapSpan * 0.5, uGapSpan * 0.5 + 0.008, d);
        // 自然卫星轨道是没有缺口的细实线；只有人造卫星轨道才留出小缺口
        vGap = mix(1.0, gap, uGapEnabled);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uDash;
      varying float vProgress;
      varying float vFade;
      varying float vGap;
      void main(){
        // 人造航天器的轨道用极轻的分段虚线：颜色之外的第二层区分（方案书 §14）
        float dash = mix(1.0, step(0.34, fract(vProgress * 110.0)), uDash);
        if (vGap <= 0.001) discard;
        gl_FragColor = vec4(uColor, uOpacity * vFade * vGap * dash);
      }
    `,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uTime: { value: 0 },
      uGapSpan: { value: 0.02 },
      uGapEnabled: { value: 0 },
      uDash: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
  })
}

/**
 * 单位圆轨道：位置 + 进度 + 这条轨道自己的开口相位/速度。
 * 每圈轨道一份几何体（几百个顶点），材质仍然共用，所以 draw call 不变。
 */
export function buildOrbitGeometry(
  template: Float32Array,
  gapPhase = 0,
  gapSpeed = 0
): THREE.BufferGeometry {
  const count = template.length / 3
  const positions = new Float32Array(template)
  const progress = new Float32Array(count)
  const phases = new Float32Array(count)
  const speeds = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    progress[i] = i / count
    phases[i] = gapPhase
    speeds[i] = gapSpeed
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aProgress', new THREE.BufferAttribute(progress, 1))
  geometry.setAttribute('aGapPhase', new THREE.BufferAttribute(phases, 1))
  geometry.setAttribute('aGapSpeed', new THREE.BufferAttribute(speeds, 1))
  return geometry
}
