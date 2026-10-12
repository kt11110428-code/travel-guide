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

function filterSpotsByBounds(spots, bounds) {
  return spots.filter((spot) =>
    spot.lat >= bounds.south && spot.lat <= bounds.north &&
    spot.lng >= bounds.west && spot.lng <= bounds.east
  );
}

// filterSpotsByTagsと違い、checkedTagsが空なら0件（地図の再検索は「全部チェック」が初期状態のため）。
function searchSpotsInArea(spots, bounds, checkedTags) {
  return filterSpotsByBounds(spots, bounds).filter((spot) =>
    spot.tags.some((tag) => checkedTags.includes(tag))
  );
}

// 現在地などを中心にした一辺 sideMeters の正方形の範囲。
function squareBounds(lat, lng, sideMeters) {
  const halfKm = sideMeters / 2000;
  const dLat = (halfKm / 6371) * (180 / Math.PI);
  const dLng = dLat / Math.cos((lat * Math.PI) / 180);
  return { south: lat - dLat, north: lat + dLat, west: lng - dLng, east: lng + dLng };
}

// ---- Wikipedia 位置情報検索（地図を動かしたときの動的スポット） ----

const WIKIPEDIA_API = "https://ja.wikipedia.org/w/api.php";
const WIKIPEDIA_MAX_RADIUS_M = 10000; // geosearch APIの上限
const WIKIPEDIA_EXTRACT_CHUNK = 20; // extractsを一度に返す件数の上限

function wikipediaGeosearchUrl(lat, lng, radiusM) {
  return (
    WIKIPEDIA_API + "?action=query&format=json&origin=*&generator=geosearch" +
    "&ggscoord=" + encodeURIComponent(lat + "|" + lng) +
    "&ggsradius=" + radiusM + "&ggslimit=50" +
    "&prop=coordinates%7Cinfo%7Cextracts&exintro=1&explaintext=1&exlimit=max&colimit=max"
  );
}

function wikipediaExtractsUrl(pageIds) {
  return (
    WIKIPEDIA_API + "?action=query&format=json&origin=*&prop=extracts&exintro=1&explaintext=1&exlimit=max" +
    "&pageids=" + encodeURIComponent(pageIds.join("|"))
  );
}

// 表示範囲の中心〜隅の距離を検索半径(m)として返す。10kmを超える広さならnull（拡大を促す）。
function wikipediaSearchRadiusM(bounds) {
  const centerLat = (bounds.south + bounds.north) / 2;
  const centerLng = (bounds.west + bounds.east) / 2;
  const meters = haversineKm(centerLat, centerLng, bounds.north, bounds.east) * 1000;
  if (meters > WIKIPEDIA_MAX_RADIUS_M) return null;
  return Math.max(500, Math.ceil(meters));
}

function stripTitleQualifier(title) {
  return title.replace(/\s*[（(][^）)]*[）)]\s*$/, "");
}

const WIKIPEDIA_EXCLUDED_TITLE =
  /(駅|停留場|停留所|学校|高校|幼稚園|保育園|大学|郵便局|交番|警察署|警察|消防署|裁判所|検察庁|インターチェンジ|ジャンクション|変電所|病院|県|市|町|村|丁目|大字|支店|営業所|会社|協会|本部|ホテル|旅館|鉄道|電鉄|バス|高速道路|自動車道|道路|バイパス|線|大橋|高架橋|陸橋|事故|事件)$|^(国道|県道|府道|都道)/;

function isExcludedWikipediaTitle(title) {
  return WIKIPEDIA_EXCLUDED_TITLE.test(stripTitleQualifier(title));
}

// 地理・歴史・文化と関係のない施設を、冒頭の一文の語から除く。
const WIKIPEDIA_EXCLUDED_INTRO =
  /高速道路|自動車道|国道|県道|鉄道路線|路線|インターチェンジ|ジャンクション|商業施設|ショッピング|会社|企業/;

function isExcludedWikipediaIntro(extract) {
  return WIKIPEDIA_EXCLUDED_INTRO.test((extract || "").split("。")[0]);
}

// 説明文は誤判定しやすい（寺の「山号」など）ため、タイトルの語と、種別を表す複合語だけを手掛かりにする。
const WIKIPEDIA_TAG_RULES = [
  ["歴史", /(寺|神社|大社|神宮|城|古墳|遺跡|史跡|陣屋|関所|墓|塔|院|堂|殿|屋敷|藩|跡)$/, /(寺院|神社|城跡|城郭|古墳|遺跡|史跡|の墓)/],
  ["地理", /(川|峠|盆地|平野|半島|岬|湾|港|橋|断層|台地|洲|谷)$/, /(河川|盆地|平野|半島|地形|峠|湾|断層|山地|山系)/],
  ["文化", /(美術館|博物館|資料館|記念館|劇場|図書館|祭|工芸|文化財|像)$/, /(美術館|博物館|劇場|文化財|伝統工芸)/],
  ["自然", /(山|岳|峰|渓|滝|湖|池|島|海岸|浜|公園|森|庭園)$/, /(山岳|火山|湖沼|滝|渓谷|公園|庭園)/],
];

function inferWikipediaTags(title, extract) {
  const name = stripTitleQualifier(title);
  const firstSentence = (extract || "").split("。")[0];
  const tags = WIKIPEDIA_TAG_RULES
    .filter((rule) => rule[1].test(name) || rule[2].test(firstSentence))
    .map((rule) => rule[0]);
  return tags;
}

function parseGeosearchPages(json) {
  const pages = (json && json.query && json.query.pages) || {};
  return Object.keys(pages)
    .map((key) => pages[key])
    .filter((page) => page.coordinates && page.coordinates.length > 0)
    .map((page) => ({
      pageId: page.pageid,
      title: page.title,
      lat: page.coordinates[0].lat,
      lng: page.coordinates[0].lon,
      extract: page.extract || "",
      length: page.length || 0,
    }));
}

function parseExtracts(json) {
  const pages = (json && json.query && json.query.pages) || {};
  const result = {};
  Object.keys(pages).forEach((key) => {
    if (pages[key].extract) result[key] = pages[key].extract;
  });
  return result;
}

function firstSentenceOf(text, maxLength) {
  const end = text.indexOf("。");
  const sentence = end === -1 ? text : text.slice(0, end + 1);
  return sentence.length > maxLength ? sentence.slice(0, maxLength) + "…" : sentence;
}

function introOf(text, maxLength) {
  const sentences = text.split("。").filter((s) => s !== "");
  let result = "";
  for (let i = 0; i < sentences.length; i++) {
    const next = result + sentences[i] + "。";
    if (result !== "" && next.length > maxLength) break;
    result = next;
  }
  return result;
}

// 子供向けの一言。説明文に書かれている事実（指定・創建年）だけから作り、根拠がなければ空文字。
const KIDS_NOTE_DESIGNATIONS = [
  ["世界遺産", "世界遺産（せかいいさん）に登録されている、世界中の人が守りたい大切な場所だよ。"],
  ["特別史跡", "昔のことを伝える「特別史跡」として、国がとくに大切に守っている場所だよ。"],
  ["国宝", "「国宝」に関わる、日本を代表する大切な場所だよ。"],
  ["重要文化財", "国が「重要文化財」として大切に守っているものがある場所だよ。"],
  ["史跡", "昔のことを伝える「史跡」として、国が守っている場所だよ。"],
  ["名勝", "景色がすばらしいと国に認められた「名勝」だよ。"],
  ["天然記念物", "めずらしい自然として、国が守っている「天然記念物」だよ。"],
];
const KIDS_NOTE_FOUNDING =
  /(\d{3,4})年[^。]{0,30}(?:創建|開創|創立|建立|築城|開基|開山|築造|造営|建造)|(?:創建|開創|建立|築城|開基|開山|創祀)[^。]{0,15}?(\d{3,4})年/;
const KIDS_NOTE_LONG_ARTICLE = "多くの人に知られている有名な場所だよ。どんな場所か調べてみよう！";
const WIKIPEDIA_NOTABLE_LENGTH = 12000; // 記事がこの長さ以上なら、有名な場所として扱う

function kidsNoteFromExtract(extract, nowYear) {
  const text = extract || "";
  const parts = [];
  const designation = KIDS_NOTE_DESIGNATIONS.find((entry) => text.indexOf(entry[0]) !== -1);
  if (designation) parts.push(designation[1]);
  const founding = KIDS_NOTE_FOUNDING.exec(text);
  if (founding) {
    const year = Number(founding[1] || founding[2]);
    if (year >= 300 && year <= nowYear) {
      parts.push("約" + (nowYear - year) + "年前（" + year + "年）に作られたよ。");
    }
  }
  return parts.join("");
}

// 子供にコメントできるほど重要なスポットだけを返す（除外対象・ジャンル不明・根拠のないものはnull）。
function wikipediaSpotFromPage(page, nowYear) {
  if (isExcludedWikipediaTitle(page.title) || isExcludedWikipediaIntro(page.extract)) return null;
  const tags = inferWikipediaTags(page.title, page.extract);
  if (tags.length === 0) return null;
  let kidsNote = kidsNoteFromExtract(page.extract, nowYear);
  if (kidsNote === "" && (page.length || 0) >= WIKIPEDIA_NOTABLE_LENGTH && page.extract) {
    kidsNote = KIDS_NOTE_LONG_ARTICLE;
  }
  if (kidsNote === "") return null;
  return {
    id: "wp-" + page.pageId,
    name: stripTitleQualifier(page.title),
    lat: page.lat,
    lng: page.lng,
    tags: tags,
    kidsNote: kidsNote,
    summary: firstSentenceOf(page.extract, 90),
    description: introOf(page.extract, 600),
    source: "wikipedia",
    sourceUrl: "https://ja.wikipedia.org/?curid=" + page.pageId,
  };
}

function fetchWikipediaSpots(lat, lng, radiusM, fetchJson, nowYear) {
  return fetchJson(wikipediaGeosearchUrl(lat, lng, radiusM)).then((json) => {
    const pages = parseGeosearchPages(json);
    const missingIds = pages.filter((p) => p.extract === "").map((p) => p.pageId);
    const chunks = [];
    for (let i = 0; i < missingIds.length; i += WIKIPEDIA_EXTRACT_CHUNK) {
      chunks.push(missingIds.slice(i, i + WIKIPEDIA_EXTRACT_CHUNK));
    }
    // 追加取得に失敗しても、説明文なしのままスポット自体は返す。
    return Promise.all(chunks.map((ids) =>
      fetchJson(wikipediaExtractsUrl(ids)).then(parseExtracts, () => ({}))
    )).then((extractMaps) => {
      const extracts = Object.assign({}, ...extractMaps);
      pages.forEach((p) => { if (extracts[p.pageId]) p.extract = extracts[p.pageId]; });
      return pages.map((p) => wikipediaSpotFromPage(p, nowYear)).filter((spot) => spot !== null);
    });
  });
}

function mergeSpots(curated, dynamic) {
  const extra = dynamic.filter((d) =>
    !curated.some((c) => d.name.includes(c.name) || c.name.includes(d.name))
  );
  return curated.concat(extra);
}

function sortSpotsForMap(spots, centerLat, centerLng) {
  const key = (spot) => [spot.source ? 1 : 0, haversineKm(centerLat, centerLng, spot.lat, spot.lng)];
  return spots.slice().sort((a, b) => {
    const ka = key(a), kb = key(b);
    return ka[0] - kb[0] || ka[1] - kb[1];
  });
}
