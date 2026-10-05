import {create} from 'zustand';
import {initialMotion,nextMotion,type UIMotion} from '../../../../src/lib/uiMotion';
export {parseUIMotion} from '../../../../src/lib/uiMotion';
export type {UIMotion} from '../../../../src/lib/uiMotion';
export const useUIMotion=create<{mode:UIMotion;cycle:()=>void}>(set=>({
 mode:initialMotion(),cycle:()=>set(s=>({mode:nextMotion(s.mode)})),
}));
