// 時間と乗換情報は、2026年9月14日（月）朝8時ごろの調査結果。
const data = window.MAP_DATA;
const validationErrors = window.MapDataValidation.validateMapData(data);
if (validationErrors.length) throw new Error(`路線図データに問題があります:\n${validationErrors.join('\n')}`);

const stationById = new Map(data.stations.map(station => [station.id, station]));
const destinationById = new Map(data.destinations.map(destination => [destination.id, destination]));
const destinationByStationId = new Map(data.destinations.map(destination => [destination.stationId, destination]));
let selectedDestinationId = data.defaults.destinationId;
let selectedStationId = data.defaults.originStationId;

const stationLayer = document.querySelector('.station-layer');
const select = document.getElementById('station-select');
const routeGroup = document.getElementById('active-route');
const mapLines = document.getElementById('map-lines');
const mapRegion = document.querySelector('.map-region');
const destinationSelector = document.querySelector('.destination-selector');
const findRoutePath = window.RouteEngine.createRouteFinder(data);

Object.assign(mapLines.style, {
  left: `${data.image.x / 1352 * 100}%`,
  top: `${data.image.y / 1080 * 100}%`,
  width: `${data.image.width / 1352 * 100}%`,
  height: `${data.image.height / 1080 * 100}%`
});

function drawRoute(station, destination, journey) {
  routeGroup.replaceChildren();
  const routePoints = journey
    ? findRoutePath(station.id, destination.stationId, journey.lines, journey.transferPoints, journey.originPoint)
    : [];

  const transferMarks = [];
  if (routePoints.length > 1) {
    const pathData = routePoints.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`).join(' ');
    for (const className of ['route-path-halo', 'route-path', 'route-path-sparkle']) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', className);
      path.setAttribute('data-route', 'registered');
      path.setAttribute('d', pathData);
      path.setAttribute('pathLength', '100');
      routeGroup.appendChild(path);
    }

    // 乗換地点に印を出す。
    for (let index = 1; index < routePoints.length; index++) {
      if (routePoints[index].transferFromPrevious) {
        transferMarks.push([
          (routePoints[index - 1].x + routePoints[index].x) / 2,
          (routePoints[index - 1].y + routePoints[index].y) / 2
        ]);
      }
    }
    transferMarks.push(...(journey.extraTransferPoints ?? []));
    for (const [x, y] of transferMarks) {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      marker.setAttribute('class', 'transfer-marker');
      marker.setAttribute('transform', `translate(${x} ${y})`);
      for (const [className, radius] of [['transfer-marker-ring', 11], ['transfer-marker-core', 4.5]]) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('class', className);
        circle.setAttribute('r', radius);
        marker.appendChild(circle);
      }
      routeGroup.appendChild(marker);
    }
  }

  // 乗換地点が駅ラベルと重なるときは、ラベルも強調する。
  for (const candidate of data.stations) {
    const isTransfer = transferMarks.some(([x, y]) =>
      x >= candidate.x - 6 && x <= candidate.x + candidate.width + 6 &&
      y >= candidate.y - 6 && y <= candidate.y + candidate.height + 6);
    stationLayer.querySelector(`[data-station-id="${candidate.id}"]`)?.classList.toggle('is-transfer', isTransfer);
  }

  mapRegion.classList.toggle('has-active-route', routePoints.length > 1);
  document.getElementById('travel-route').textContent = routePoints.length ? '路線図上の経路を強調表示中' : '';
}

function updateTravelDisplay() {
  const station = stationById.get(selectedStationId);
  const destination = destinationById.get(selectedDestinationId);
  const journey = station && station.journeys ? station.journeys[selectedDestinationId] : null;
  const time = journey ? (journey.minutes ?? undefined) : undefined;

  const stationText = document.getElementById('travel-station');
  stationText.textContent = station.name;
  stationText.style.fontSize = `${Math.min(11.1111, 24.6 / Array.from(station.name).length)}cqh`;
  document.getElementById('travel-destination').textContent = destination.name;

  const timeNumber = document.getElementById('travel-time-number');
  timeNumber.textContent = time ?? '—';
  const timeDigits = Array.from(String(time ?? ''));
  timeNumber.classList.toggle('is-single-digit', timeDigits.length === 1);
  timeNumber.classList.toggle('is-wide-number', timeDigits.length > 1 && timeDigits[0] !== '1');
  document.querySelector('.time-line').classList.toggle('is-unregistered', time === undefined);
  document.getElementById('travel-status').textContent = time === undefined ? 'この駅の所要時間は未登録です' : '';
  document.getElementById('transfer-count').textContent = journey ? journey.transfers : '—';

  drawRoute(station, destination, journey);
  select.value = selectedStationId;
  document.querySelectorAll('.station-label').forEach(button => {
    const active = button.dataset.destinationId
      ? button.dataset.destinationId === selectedDestinationId
      : button.dataset.stationId === selectedStationId;
    button.classList.toggle('is-selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function selectStation(stationId) {
  selectedStationId = stationId;
  updateTravelDisplay();
}

function setDestination(destinationId) {
  selectedDestinationId = destinationId;
  document.querySelectorAll('.destination-button').forEach(button => {
    const active = button.dataset.destinationId === destinationId;
    button.classList.toggle('is-selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
  updateTravelDisplay();
}

for (const destination of data.destinations) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'destination-button';
  button.dataset.destinationId = destination.id;
  button.textContent = destination.name;
  const active = destination.id === selectedDestinationId;
  button.classList.toggle('is-selected', active);
  button.setAttribute('aria-pressed', String(active));
  button.addEventListener('click', () => setDestination(destination.id));
  destinationSelector.appendChild(button);
}

for (const station of data.stations) {
  const destination = destinationByStationId.get(station.id);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'station-label';
  button.dataset.stationId = station.id;
  button.dataset.registered = String(Boolean(station.journeys));
  button.textContent = station.name;
  button.setAttribute('aria-label', `${station.name}${station.journeys ? 'からの所要時間を表示' : '（所要時間未登録）'}`);
  Object.assign(button.style, {
    left: `${station.x / 1352 * 100}%`,
    top: `${station.y / 1080 * 100}%`,
    width: `${station.width / 1352 * 100}%`,
    height: `${station.height / 1080 * 100}%`
  });
  button.style.setProperty('--station-center-x', `${(station.x + station.width / 2) / 1352 * 100}%`);
  button.style.setProperty('--station-width', `${station.width / 1352 * 100}%`);

  if (destination) {
    button.classList.add('destination');
    button.style.fontSize = `${destination.labelFontSize}cqh`;
    button.dataset.destinationId = destination.id;
    button.setAttribute('aria-label', `目的地を${destination.name}に変更`);
    button.addEventListener('click', () => setDestination(destination.id));
  } else {
    button.addEventListener('click', () => selectStation(station.id));
    const option = document.createElement('option');
    option.value = station.id;
    option.textContent = station.name + (station.journeys ? '' : '（時間未登録）');
    select.appendChild(option);
  }
  stationLayer.appendChild(button);
}

select.addEventListener('change', () => selectStation(select.value));
updateTravelDisplay();
