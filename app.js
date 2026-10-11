// app.js — 画面遷移とUIロジック

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((el) => {
    el.classList.toggle("active", el.id === screenId);
  });
}

function wireBackButtons() {
  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => showScreen(btn.dataset.back));
  });
}

wireBackButtons();

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

function tagChipsHtml(tags) {
  return tags.map((tag) =>
    '<span class="tag-chip" style="background:' + colorForTag(tag) + '">' + escapeHtml(tag) + "</span>"
  ).join("");
}

const dynamicSpotsById = new Map();

function rememberDynamicSpots(spots) {
  spots.forEach((spot) => dynamicSpotsById.set(spot.id, spot));
}

function findSpotById(id) {
  return SPOTS.find((spot) => spot.id === id) || dynamicSpotsById.get(id);
}

function spotDetailBodyHtml(spot) {
  const imageHtml = spot.image
    ? '<img src="' + escapeHtml(spot.image) + '" alt="' + escapeHtml(spot.name) + '">'
    : "";
  const kidsNoteHtml = spot.kidsNote
    ? '<div class="kids-note">🧒 ' + escapeHtml(spot.kidsNote) + "</div>"
    : "";
  const descriptionHtml = spot.description ? "<p>" + escapeHtml(spot.description) + "</p>" : "";
  const sourceHtml = spot.sourceUrl
    ? '<p class="source">出典: <a href="' + escapeHtml(spot.sourceUrl) +
      '" target="_blank" rel="noopener">Wikipedia</a>（CC BY-SA）</p>'
    : "";
  return (
    '<div class="spot-detail">' +
    "<h2>" + escapeHtml(spot.name) + "</h2>" +
    "<div>" + tagChipsHtml(spot.tags) + "</div>" +
    imageHtml +
    descriptionHtml +
    kidsNoteHtml +
    sourceHtml +
    "</div>"
  );
}

function renderSpotDetail(spotId) {
  const spot = findSpotById(spotId);
  const container = document.getElementById("detail-content");
  if (!spot) {
    container.innerHTML = '<div class="error-box">スポットが見つかりませんでした。</div>';
    showScreen("screen-detail");
    return;
  }
  container.innerHTML = spotDetailBodyHtml(spot);
  showScreen("screen-detail");
}

let nearbyResultLimit = 5;
const NEARBY_DISTANCE_LIMIT_KM = 5;

function distanceLabel(distanceKm) {
  return distanceKm < 1 ? Math.round(distanceKm * 1000) + "m" : distanceKm.toFixed(1) + "km";
}

function spotCardHtml(spot, distanceKm) {
  const distanceHtml = distanceKm === undefined
    ? ""
    : '<div class="distance">現在地から ' + distanceLabel(distanceKm) + "</div>";
  return (
    '<div class="spot-card" data-spot-id="' + escapeHtml(spot.id) + '">' +
    "<h3>" + escapeHtml(spot.name) + "</h3>" +
    distanceHtml +
    "<div>" + tagChipsHtml(spot.tags) + "</div>" +
    "<p>" + escapeHtml(spot.summary) + "</p>" +
    "</div>"
  );
}

function wireSpotCardClicks(container) {
  container.querySelectorAll("[data-spot-id]").forEach((card) => {
    card.addEventListener("click", () => renderSpotDetail(card.dataset.spotId));
  });
}

function renderNearbyResults(lat, lng) {
  const container = document.getElementById("nearby-content");
  const results = nearestSpots(SPOTS, lat, lng, nearbyResultLimit);
  if (results.length === 0 || results[0].distanceKm > NEARBY_DISTANCE_LIMIT_KM) {
    container.innerHTML =
      '<div class="error-box">近くに登録スポットがありません。「地図から探す」「一覧から探す」もお試しください。</div>';
    return;
  }
  const closest = results[0];
  const rest = results.slice(1);
  const restHtml = rest.map((r) => spotCardHtml(r.spot, r.distanceKm)).join("");
  const limitOptionHtml = (value, label) =>
    '<option value="' + value + '"' + (nearbyResultLimit === value ? " selected" : "") + ">" + label + "</option>";
  container.innerHTML =
    "<h2>いちばん近いスポット</h2>" +
    '<div class="distance">現在地から ' + distanceLabel(closest.distanceKm) + "</div>" +
    spotDetailBodyHtml(closest.spot) +
    '<label>表示件数: <select id="nearby-limit">' +
    limitOptionHtml(3, "3件") +
    limitOptionHtml(5, "5件") +
    limitOptionHtml(10, "10件") +
    "</select></label>" +
    "<h3>近くのスポット</h3>" +
    '<div id="nearby-rest">' + restHtml + "</div>";
  wireSpotCardClicks(container);
  document.getElementById("nearby-limit").addEventListener("change", (event) => {
    nearbyResultLimit = Number(event.target.value);
    renderNearbyResults(lat, lng);
  });
}

function requestLocationAndRender() {
  const container = document.getElementById("nearby-content");
  container.innerHTML = "<p>現在地を取得中です…</p>";
  showScreen("screen-nearby");
  if (!navigator.geolocation) {
    container.innerHTML =
      '<div class="error-box">このブラウザは位置情報に対応していません。「地図から探す」「一覧から探す」をお使いください。</div>';
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      renderNearbyResults(position.coords.latitude, position.coords.longitude);
    },
    (error) => {
      container.innerHTML =
        '<div class="error-box">位置情報を取得できませんでした（' + escapeHtml(error.message) +
        '）。「地図から探す」「一覧から探す」をお使いください。</div>';
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

document.getElementById("btn-gps").addEventListener("click", requestLocationAndRender);

function allTagsUsed() {
  const set = new Set();
  SPOTS.forEach((spot) => spot.tags.forEach((tag) => set.add(tag)));
  return [...set].sort();
}

function tagCheckboxesHtml(allTags, activeTags) {
  return allTags.map((tag) => {
    const checked = activeTags.includes(tag) ? "checked" : "";
    return (
      '<label class="tag-filter"><input type="checkbox" value="' + escapeHtml(tag) + '" ' + checked + ">" +
      '<span class="tag-chip" style="background:' + colorForTag(tag) + '">' + escapeHtml(tag) + "</span>" +
      "</label>"
    );
  }).join("");
}

function renderList(activeTags) {
  const container = document.getElementById("list-content");
  const tags = allTagsUsed();
  const filtered = filterSpotsByTags(SPOTS, activeTags);
  const itemsHtml = filtered.map((spot) =>
    '<div class="spot-card" data-spot-id="' + escapeHtml(spot.id) + '">' +
    "<h3>" + escapeHtml(spot.name) + "</h3>" +
    "<div>" + tagChipsHtml(spot.tags) + "</div>" +
    "<p>" + escapeHtml(spot.summary) + "</p>" +
    "</div>"
  ).join("");
  container.innerHTML =
    '<div id="list-tag-filter">' + tagCheckboxesHtml(tags, activeTags) + "</div>" +
    '<div id="list-items">' + (itemsHtml || "<p>該当するスポットがありません。</p>") + "</div>";
  wireSpotCardClicks(container);
  container.querySelectorAll('#list-tag-filter input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const nextActive = [...container.querySelectorAll('#list-tag-filter input:checked')].map((el) => el.value);
      renderList(nextActive);
    });
  });
}

document.getElementById("btn-list").addEventListener("click", () => {
  showScreen("screen-list");
  renderList([]);
});

let mapInstance = null;
let mapMarkers = [];
let tileFallbackTriggered = false;

function tileLoadFailed() {
  if (tileFallbackTriggered) return;
  tileFallbackTriggered = true;
  showScreen("screen-list");
  renderList([]);
  document.getElementById("list-content").insertAdjacentHTML(
    "afterbegin",
    '<div class="error-box">地図を読み込めませんでした（オフラインの可能性があります）。一覧から探してください。</div>'
  );
}

function renderMapMarkers(visibleSpots) {
  mapMarkers.forEach((marker) => mapInstance.removeLayer(marker));
  mapMarkers = [];
  visibleSpots.forEach((spot) => {
    const marker = L.circleMarker([spot.lat, spot.lng], {
      radius: 9,
      color: colorForSpot(spot),
      fillColor: colorForSpot(spot),
      fillOpacity: 0.9,
    }).addTo(mapInstance);
    marker.bindPopup("<b>" + escapeHtml(spot.name) + "</b><br>" + escapeHtml(spot.summary));
    marker.on("click", () => renderSpotDetail(spot.id));
    mapMarkers.push(marker);
  });
}

function renderMapSearchResults(spots, status) {
  const container = document.getElementById("map-results");
  const statusHtml = status ? '<div class="map-status">' + escapeHtml(status) + "</div>" : "";
  const bodyHtml = spots.length === 0
    ? '<div class="error-box">このエリアには該当するスポットがありません。地図を動かすか、ジャンルのチェックを変えてください。</div>'
    : "<h3>このエリアのスポット " + spots.length + "件</h3>" + spots.map((spot) => spotCardHtml(spot)).join("");
  container.innerHTML = statusHtml + bodyHtml;
  wireSpotCardClicks(container);
}

let mapDynamicSpots = [];
let mapStatus = "";
let mapSearchSeq = 0;
let mapMoveTimer = null;

function mapFetchJson(url) {
  return fetch(url).then((response) => {
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json();
  });
}

function currentMapBounds() {
  const b = mapInstance.getBounds();
  return { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() };
}

// 通信なしで、いま保持しているスポットを表示範囲×チェック中のジャンルで絞り込んで描き直す。
function refreshMapView() {
  if (!mapInstance) return;
  const container = document.getElementById("map-content");
  const checkedTags = [...container.querySelectorAll('#map-tag-filter input:checked')].map((el) => el.value);
  const center = mapInstance.getCenter();
  const all = mergeSpots(SPOTS, mapDynamicSpots);
  const found = sortSpotsForMap(searchSpotsInArea(all, currentMapBounds(), checkedTags), center.lat, center.lng);
  renderMapMarkers(found);
  renderMapSearchResults(found, mapStatus);
}

// 表示範囲の中心付近のスポットをWikipediaから取得して表示し直す。
function loadMapSpots() {
  if (!mapInstance) return;
  const seq = ++mapSearchSeq;
  const radiusM = wikipediaSearchRadiusM(currentMapBounds());
  if (radiusM === null) {
    mapDynamicSpots = [];
    mapStatus = "もう少し拡大すると、Wikipediaのスポットも検索します。";
    refreshMapView();
    return;
  }
  const center = mapInstance.getCenter();
  mapStatus = "Wikipediaからスポットを検索中…";
  refreshMapView();
  fetchWikipediaSpots(center.lat, center.lng, radiusM, mapFetchJson).then(
    (spots) => {
      if (seq !== mapSearchSeq) return;
      rememberDynamicSpots(spots);
      mapDynamicSpots = spots;
      mapStatus = "";
      refreshMapView();
    },
    () => {
      if (seq !== mapSearchSeq) return;
      mapDynamicSpots = [];
      mapStatus = "Wikipediaのスポットを取得できませんでした。通信状況を確認して「このエリアを再読み込み」を押してください。";
      refreshMapView();
    }
  );
}

function renderMap() {
  tileFallbackTriggered = false;
  showScreen("screen-map");
  const container = document.getElementById("map-content");
  const tags = allTagsUsed().filter((tag) => tag !== "その他").concat("その他");
  container.innerHTML =
    '<div id="map-tag-filter">' + tagCheckboxesHtml(tags, tags) + "</div>" +
    '<button class="research-button" id="map-research">このエリアを再読み込み</button>' +
    '<div id="leaflet-map" class="leaflet-map"></div>' +
    '<div id="map-results"></div>' +
    '<div id="map-attribution" class="map-attribution">スポット情報: ' +
    '<a href="https://ja.wikipedia.org/" target="_blank" rel="noopener">Wikipedia</a>（CC BY-SA）／' +
    "地図: OpenStreetMap contributors</div>";
  document.getElementById("map-research").addEventListener("click", loadMapSpots);
  container.querySelectorAll('#map-tag-filter input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener("change", refreshMapView);
  });

  if (typeof L === "undefined") {
    tileLoadFailed();
    return;
  }
  // 前回のLeafletインスタンスは古い（削除済みの）#leaflet-map要素を参照しているため、
  // 再入場のたびに作り直す（コンテナをinnerHTMLで再構築しているため）。
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
  mapInstance = L.map("leaflet-map").setView([35.0, 135.7], 9);
  const tileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors",
  });
  let anyTileLoaded = false;
  tileLayer.on("tileload", () => { anyTileLoaded = true; });
  tileLayer.on("tileerror", () => { if (!anyTileLoaded) tileLoadFailed(); });
  tileLayer.addTo(mapInstance);
  mapInstance.invalidateSize();
  mapDynamicSpots = [];
  mapStatus = "";
  loadMapSpots();
  // 初期表示の移動で二重に検索しないよう、ここから先の移動だけを監視する。
  mapInstance.on("moveend", () => {
    clearTimeout(mapMoveTimer);
    mapMoveTimer = setTimeout(loadMapSpots, 600);
  });
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      L.marker([position.coords.latitude, position.coords.longitude]).addTo(mapInstance).bindPopup("現在地");
    });
  }
}

document.getElementById("btn-map").addEventListener("click", renderMap);
