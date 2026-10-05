import {create} from 'zustand';
import {initialMotion,nextMotion,type UIMotion} from '../lib/uiMotion';
export const useUIMotion=create<{mode:UIMotion;cycle:()=>void}>(set=>({
 mode:initialMotion(),cycle:()=>set(s=>({mode:nextMotion(s.mode)})),
}));
