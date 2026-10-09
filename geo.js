// geo.js — スポットデータの検証と、距離・タグに関する純粋なロジック関数群。
// ブラウザでは <script src="geo.js"> で読み込み、テストでは jsc に直接渡して実行する。

function validateSpots(spots) {
  const errors = [];
  const seenIds = new Set();
  spots.forEach((spot, index) => {
    const label = "SPOTS[" + index + "]";
    if (!spot.id || typeof spot.id !== "string") {
      errors.push(label + ": id が未設定");
    } else if (seenIds.has(spot.id)) {
      errors.push(label + ': id "' + spot.id + '" が重複');
    } else {
      seenIds.add(spot.id);
    }
    if (!spot.name) errors.push(label + ": name が未設定");
    if (typeof spot.lat !== "number" || spot.lat < -90 || spot.lat > 90) {
      errors.push(label + ": lat が不正 (" + spot.lat + ")");
    }
    if (typeof spot.lng !== "number" || spot.lng < -180 || spot.lng > 180) {
      errors.push(label + ": lng が不正 (" + spot.lng + ")");
    }
    if (!Array.isArray(spot.tags) || spot.tags.length === 0) {
      errors.push(label + ": tags が未設定");
    }
    if (!spot.summary) errors.push(label + ": summary が未設定");
    if (!spot.description) errors.push(label + ": description が未設定");
  });
  return errors;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function nearestSpots(spots, lat, lng, limit) {
  const withDistance = spots.map((spot) => ({
    spot: spot,
    distanceKm: haversineKm(lat, lng, spot.lat, spot.lng),
  }));
  withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
  const safeLimit = Math.max(0, limit);
  return withDistance.slice(0, safeLimit);
}

const TAG_COLORS = {
  "歴史": "#8B5E34",
  "地理": "#2E7D32",
  "文化": "#6A1B9A",
  "自然": "#1565C0",
};
const DEFAULT_TAG_COLOR = "#555555";

function colorForTag(tag) {
  return TAG_COLORS[tag] || DEFAULT_TAG_COLOR;
}

function colorForSpot(spot) {
  return colorForTag(spot.tags && spot.tags[0]);
}

function filterSpotsByTags(spots, activeTags) {
  if (!activeTags || activeTags.length === 0) return spots;
  return spots.filter((spot) => spot.tags.some((tag) => activeTags.includes(tag)));
}
