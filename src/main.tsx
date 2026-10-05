import { isEarthLink, solarEntry } from './lib/entryRoute';
// Only explicit Earth links load the Earth engine. The universe is the entry.
if (isEarthLink(location.search)) void import('./earth-entry');
else location.replace(solarEntry(location.search));
