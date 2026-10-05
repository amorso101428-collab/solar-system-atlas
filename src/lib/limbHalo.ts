/** A continuous exponential optical-depth approximation at the ellipsoid limb.
 * Native Cesium scattering handles the ground; this small screen-space pass
 * keeps a blue, density-falling outer limb visible in the fully lit presentation. */
export function limbOpacity(height:number){return Number.isFinite(height)?.42*Math.exp(-Math.abs(height)/22000)*(1-smoothstep(90000,150000,Math.abs(height))):0;}
function smoothstep(a:number,b:number,x:number){const f=Math.max(0,Math.min(1,(x-a)/(b-a)));return f*f*(3-2*f);}
export const LIMB_SHADER=`
uniform sampler2D colorTexture;
in vec2 v_textureCoordinates;
void main(){
 vec4 base=texture(colorTexture,v_textureCoordinates);
 vec2 ndc=v_textureCoordinates*2.0-1.0;
 vec4 eye=czm_inverseProjection*vec4(ndc,0.0,1.0);
 vec3 dir=normalize(czm_inverseViewRotation*(eye.xyz/eye.w));
 vec3 invR=vec3(1.0/6378137.0,1.0/6378137.0,1.0/6356752.314245);
 vec3 o=czm_viewerPositionWC*invR,d=dir*invR;
 float closest=-dot(o,d)/dot(d,d);
 float height=(length(o+d*max(closest,0.0))-1.0)*6371000.0;
 float fade=1.0-smoothstep(90000.0,150000.0,abs(height));
 float alpha=closest>0.0?0.42*exp(-abs(height)/22000.0)*fade:0.0;
 out_FragColor=vec4(mix(base.rgb,vec3(0.20,0.52,0.94),alpha),base.a);
}`;
