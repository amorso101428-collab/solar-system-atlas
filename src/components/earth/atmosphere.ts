import type * as Cesium from 'cesium';
import {LIMB_SHADER} from '../../lib/limbHalo';
import type {Engine} from '../../lib/earthEngine';
/** Always install an actual scattering atmosphere, independent of the starbox.
 * Camera-lit daytime presentation matches the fully lit satellite globe. */
export function configureAtmosphere(C:Engine,v:Cesium.Viewer){
 if(!v.scene.skyAtmosphere)v.scene.skyAtmosphere=new C.SkyAtmosphere(C.Ellipsoid.WGS84);
 const sky=v.scene.skyAtmosphere,ground=v.scene.globe;
 for(const layer of [sky,ground]){
  layer.atmosphereRayleighCoefficient=new C.Cartesian3(5.5e-6,13e-6,28.4e-6);
  layer.atmosphereMieCoefficient=new C.Cartesian3(2e-6,2e-6,2e-6);
  layer.atmosphereRayleighScaleHeight=12000;layer.atmosphereMieScaleHeight=1500;layer.atmosphereMieAnisotropy=.65;layer.atmosphereLightIntensity=18;
 }
 sky.show=true;sky.perFragmentAtmosphere=true;sky.saturationShift=0;sky.brightnessShift=.02;
 v.scene.atmosphere.dynamicLighting=C.DynamicAtmosphereLightingType.NONE;
 ground.dynamicAtmosphereLighting=false;ground.showGroundAtmosphere=true;ground.atmosphereBrightnessShift=0;ground.atmosphereRayleighScaleHeight=8000;ground.atmosphereRayleighCoefficient=new C.Cartesian3(2.75e-6,6.5e-6,14.2e-6);ground.atmosphereLightIntensity=14;v.scene.fog.density=.000025;
 const halo=v.scene.postProcessStages.add(new C.PostProcessStage({name:'earth-density-limb',fragmentShader:LIMB_SHADER}));
 return {halo,dispose:()=>{if(!v.isDestroyed())v.scene.postProcessStages.remove(halo);}};
}
