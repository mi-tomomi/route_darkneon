(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MapDataValidation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const isPoint = point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite);

  function validateMapData(data) {
    const errors = [];
    if (!data || !Array.isArray(data.stations)) return ['stations がありません'];
    if (!Array.isArray(data.destinations) || !data.destinations.length) errors.push('destinations がありません');
    if (!data.routes || typeof data.routes !== 'object') errors.push('routes がありません');

    const stationIds = new Set();
    const stationNames = new Set();
    for (const station of data.stations) {
      if (!station.id) errors.push(`IDがない駅があります: ${station.name || '名称未設定'}`);
      else if (stationIds.has(station.id)) errors.push(`駅IDが重複しています: ${station.id}`);
      stationIds.add(station.id);
      if (!station.name) errors.push(`駅名がない駅があります: ${station.id || 'ID未設定'}`);
      else if (stationNames.has(station.name)) errors.push(`駅名が重複しています: ${station.name}`);
      stationNames.add(station.name);
      for (const key of ['x', 'y', 'width', 'height']) {
        if (!Number.isFinite(station[key])) errors.push(`${station.name || station.id} の ${key} が不正です`);
      }
    }

    const destinationIds = new Set();
    const destinationStationIds = new Set();
    for (const destination of data.destinations || []) {
      if (!destination.id || destinationIds.has(destination.id)) errors.push(`目的地IDが未設定または重複しています: ${destination.id || '未設定'}`);
      destinationIds.add(destination.id);
      destinationStationIds.add(destination.stationId);
      if (!stationIds.has(destination.stationId)) errors.push(`${destination.name || destination.id} の駅IDが見つかりません: ${destination.stationId}`);
      if (!data.routes[destination.arrivalLine]) errors.push(`${destination.name || destination.id} の到着路線が見つかりません: ${destination.arrivalLine}`);
    }

    if (!stationIds.has(data.defaults && data.defaults.originStationId)) errors.push('初期出発駅IDが不正です');
    if (!destinationIds.has(data.defaults && data.defaults.destinationId)) errors.push('初期目的地IDが不正です');

    for (const station of data.stations) {
      if (destinationStationIds.has(station.id)) continue;
      if (!station.journeys || typeof station.journeys !== 'object') {
        errors.push(`${station.name} の移動データがありません`);
        continue;
      }
      for (const destination of data.destinations || []) {
        const journey = station.journeys[destination.id];
        const label = `${station.name}→${destination.name}`;
        if (!journey) {
          errors.push(`${label} の移動データがありません`);
          continue;
        }
        const pendingTime = journey.timeStatus === 'pending' && journey.minutes === null;
        if (!pendingTime && (!Number.isFinite(journey.minutes) || journey.minutes < 0)) errors.push(`${label} の所要時間が不正です`);
        if (!Number.isInteger(journey.transfers) || journey.transfers < 0) errors.push(`${label} の乗換回数が不正です`);
        const hasLines = Array.isArray(journey.lines) && journey.lines.length > 0;
        if (!hasLines) errors.push(`${label} の使用路線がありません`);
        else {
          for (const line of journey.lines) if (!data.routes[line]) errors.push(`${label} の路線が路線図にありません: ${line}`);
          if (journey.lines[journey.lines.length - 1] !== destination.arrivalLine) errors.push(`${label} の終着路線が ${destination.arrivalLine} ではありません`);
        }
        if (!Array.isArray(journey.transferPoints) || (hasLines && journey.transferPoints.length !== journey.lines.length - 1)) {
          errors.push(`${label} の路線数と乗換地点数が一致しません`);
        } else if (!journey.transferPoints.every(isPoint)) errors.push(`${label} の乗換地点座標が不正です`);
        if (journey.extraTransferPoints && !journey.extraTransferPoints.every(isPoint)) errors.push(`${label} の追加乗換地点座標が不正です`);
        if (journey.originPoint && !isPoint(journey.originPoint)) errors.push(`${label} の経路開始地点座標が不正です`);
      }
      for (const destinationId of Object.keys(station.journeys)) {
        if (!destinationIds.has(destinationId)) errors.push(`${station.name} に未登録の目的地IDがあります: ${destinationId}`);
      }
    }
    return errors;
  }

  return { validateMapData };
});
