const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { validateMapData } = require('./data-validation.js');
const { createRouteFinder } = require('./route-engine.js');

const source = fs.readFileSync(path.join(__dirname, 'map-data.js'), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox, { filename: 'map-data.js' });
const data = sandbox.window.MAP_DATA;
const errors = validateMapData(data);
const destinationById = new Map(data.destinations.map(destination => [destination.id, destination]));
const findRoute = createRouteFinder(data);

for (const station of data.stations) {
  for (const [destinationId, journey] of Object.entries(station.journeys || {})) {
    const destination = destinationById.get(destinationId);
    if (!destination) continue;
    const label = `${station.name}→${destination.name}`;
    if (!Array.isArray(journey.lines) || !Array.isArray(journey.transferPoints)) continue;
    const route = findRoute(station.id, destination.stationId, journey.lines, journey.transferPoints, journey.originPoint);
    if (route.length < 2) {
      errors.push(`${label} の描画経路を生成できません`);
      continue;
    }
    const transferMarkers = route.filter(point => point.transferFromPrevious).length + (journey.extraTransferPoints || []).length;
    if (transferMarkers !== journey.transfers) errors.push(`${label} の乗換回数と描画マーカー数が一致しません`);
  }
}

if (errors.length) {
  console.error(errors.map(error => `- ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  const journeys = data.stations.reduce((total, station) => total + Object.keys(station.journeys || {}).length, 0);
  console.log(`OK: ${data.stations.length}駅・${data.destinations.length}目的地・${journeys}経路を確認しました`);
}
