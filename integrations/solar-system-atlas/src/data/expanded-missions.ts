import data from './expanded-missions.json'
import {makeObject, type ExtraSpec} from './extra-shared'
export const EXPANDED_MISSIONS = (data as ExtraSpec[]).map(makeObject)
