import { create } from 'zustand'
export type ObservationView = 'day' | 'terminator' | 'night'
export const useExperience = create<{ orbit: boolean; rotate: boolean; immersive: boolean; sound: boolean; annotations: boolean; context: boolean; sunSpectrum: 'halpha' | 'white'; observation: ObservationView | null }>(() => ({ orbit: false, rotate: false, immersive: false, sound: true, annotations: true, context: true, sunSpectrum: 'halpha', observation: null }))
export function cameraCommand(action: string) { window.dispatchEvent(new CustomEvent('atlas-camera', { detail: action })) }
