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

function findSpotById(id) {
  return SPOTS.find((spot) => spot.id === id);
}

function renderSpotDetail(spotId) {
  const spot = findSpotById(spotId);
  const container = document.getElementById("detail-content");
  if (!spot) {
    container.innerHTML = '<div class="error-box">スポットが見つかりませんでした。</div>';
    showScreen("screen-detail");
    return;
  }
  const imageHtml = spot.image
    ? '<img src="' + escapeHtml(spot.image) + '" alt="' + escapeHtml(spot.name) + '">'
    : "";
  const kidsNoteHtml = spot.kidsNote
    ? '<div class="kids-note">🧒 ' + escapeHtml(spot.kidsNote) + "</div>"
    : "";
  container.innerHTML =
    '<div class="spot-detail">' +
    "<h2>" + escapeHtml(spot.name) + "</h2>" +
    "<div>" + tagChipsHtml(spot.tags) + "</div>" +
    imageHtml +
    "<p>" + escapeHtml(spot.description) + "</p>" +
    kidsNoteHtml +
    "</div>";
  showScreen("screen-detail");
}

let nearbyResultLimit = 5;
const NEARBY_DISTANCE_LIMIT_KM = 5;

function spotCardHtml(spot, distanceKm) {
  const distanceLabel = distanceKm < 1
    ? Math.round(distanceKm * 1000) + "m"
    : distanceKm.toFixed(1) + "km";
  return (
    '<div class="spot-card" data-spot-id="' + escapeHtml(spot.id) + '">' +
    "<h3>" + escapeHtml(spot.name) + "</h3>" +
    '<div class="distance">現在地から ' + distanceLabel + "</div>" +
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
  container.innerHTML =
    '<div class="spot-detail"><h2>いちばん近いスポット</h2></div>' +
    spotCardHtml(closest.spot, closest.distanceKm) +
    '<label>表示件数: <select id="nearby-limit">' +
    '<option value="3">3件</option>' +
    '<option value="5" selected>5件</option>' +
    '<option value="10">10件</option>' +
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

document.getElementById("btn-list").addEventListener("click", () => renderList([]));

let mapInstance = null;
let mapMarkers = [];
let mapActiveTags = [];
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

function renderMapMarkers(activeTags) {
  mapMarkers.forEach((marker) => mapInstance.removeLayer(marker));
  mapMarkers = [];
  const visible = filterSpotsByTags(SPOTS, activeTags);
  visible.forEach((spot) => {
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

function renderMap() {
  tileFallbackTriggered = false;
  const container = document.getElementById("map-content");
  const tags = allTagsUsed();
  container.innerHTML =
    '<div id="map-tag-filter">' + tagCheckboxesHtml(tags, mapActiveTags) + "</div>" +
    '<div id="leaflet-map" class="leaflet-map"></div>';
  container.querySelectorAll('#map-tag-filter input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      mapActiveTags = [...container.querySelectorAll('#map-tag-filter input:checked')].map((el) => el.value);
      renderMapMarkers(mapActiveTags);
    });
  });

  if (typeof L === "undefined") {
    tileLoadFailed();
    return;
  }
  if (!mapInstance) {
    mapInstance = L.map("leaflet-map").setView([35.0, 135.7], 9);
    const tileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap contributors",
    });
    tileLayer.on("tileerror", tileLoadFailed);
    tileLayer.addTo(mapInstance);
  } else {
    mapInstance.setView([35.0, 135.7], 9);
  }
  renderMapMarkers(mapActiveTags);
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      L.marker([position.coords.latitude, position.coords.longitude]).addTo(mapInstance).bindPopup("現在地");
    });
  }
}

document.getElementById("btn-map").addEventListener("click", renderMap);
