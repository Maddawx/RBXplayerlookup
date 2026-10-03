// Shared Roblox data layer. Used by the local server (server.js) and the
// Netlify function (netlify/functions/api.js). No cookie is stored here; it is
// passed in per request as ctx.cookie, so nothing leaks between callers.
const HEADERS = { "User-Agent": "Mozilla/5.0 (PlayerLookup)", Accept: "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MAX_CONCURRENT = 5;
const MAX_RETRIES = 5;
let active = 0;
const queue = [];
const pauseUntil = {};
let csrfToken = "";

function schedule(fn) {
  return new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); pump(); });
}
function pump() {
  while (active < MAX_CONCURRENT && queue.length) {
    const { fn, resolve, reject } = queue.shift();
    active++;
    fn().then(resolve, reject).finally(() => { active--; pump(); });
  }
}

// ctx = { cookie }  — cookie is only ever sent to *.roblox.com.
async function getJson(ctx, url, opts = {}) {
  const host = new URL(url).hostname;
  const auth = ctx.cookie && host.endsWith(".roblox.com") ? { Cookie: `.ROBLOSECURITY=${ctx.cookie}` } : {};
  for (let attempt = 0; ; attempt++) {
    const wait = (pauseUntil[host] || 0) - Date.now();
    if (wait > 0) await sleep(wait);
    const go = () => fetch(url, { ...opts, headers: { ...HEADERS, ...auth, ...(csrfToken ? { "X-CSRF-TOKEN": csrfToken } : {}), ...(opts.headers || {}) } });
    let r = await schedule(go);
    if (r.status === 403 && r.headers.get("x-csrf-token")) { csrfToken = r.headers.get("x-csrf-token"); r = await schedule(go); }

    if ((r.status === 429 || r.status >= 500) && attempt < MAX_RETRIES) {
      const retryAfter = Number(r.headers.get("retry-after"));
      const delay = retryAfter > 0 ? retryAfter * 1000 : Math.min(8000, 600 * 2 ** attempt) + Math.random() * 400;
      if (r.status === 429) pauseUntil[host] = Math.max(pauseUntil[host] || 0, Date.now() + delay);
      await sleep(delay);
      continue;
    }
    if (!r.ok) {
      const u = new URL(url);
      const text = await r.text().catch(() => "");
      let robloxMsg = "";
      try { robloxMsg = JSON.parse(text).errors?.[0]?.message || ""; } catch { robloxMsg = text.slice(0, 200); }
      const err = new Error(r.status === 429
        ? "Roblox is rate-limiting requests right now. Wait a few seconds and try again"
        : `Roblox returned ${r.status} for ${u.hostname}${u.pathname}`);
      err.status = r.status; err.robloxMsg = robloxMsg; err.where = u.hostname + u.pathname;
      throw err;
    }
    return r.json();
  }
}
const postJson = (ctx, url, body) => getJson(ctx, url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// Thumbnail/outfit cache. Thumbnails are public, so sharing them is fine.
const memo = new Map();
const MEMO_MS = 10 * 60_000;
function memoGet(k) { const v = memo.get(k); if (v && Date.now() - v.at < MEMO_MS) return v.value; memo.delete(k); return undefined; }
function memoSet(k, value) { memo.set(k, { at: Date.now(), value }); if (memo.size > 5000) memo.delete(memo.keys().next().value); }

async function paged(ctx, baseUrl, max) {
  let cursor = "", out = [];
  while (out.length < max) {
    const r = await getJson(ctx, baseUrl + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""));
    out = out.concat(r.data || []);
    if (!r.nextPageCursor) break;
    cursor = r.nextPageCursor;
  }
  return out.slice(0, max);
}

const THUMB = {
  head: (ids, s) => `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${ids}&size=${s}&format=Png&isCircular=false`,
  avatar: (ids, s) => `https://thumbnails.roblox.com/v1/users/avatar?userIds=${ids}&size=${s}&format=Png&isCircular=false`,
  asset: (ids, s) => `https://thumbnails.roblox.com/v1/assets?assetIds=${ids}&size=${s}&format=Png&isCircular=false`,
  badge: (ids, s) => `https://thumbnails.roblox.com/v1/badges/icons?badgeIds=${ids}&size=${s}&format=Png&isCircular=false`,
  group: (ids, s) => `https://thumbnails.roblox.com/v1/groups/icons?groupIds=${ids}&size=${s}&format=Png&isCircular=false`,
  game: (ids, s) => `https://thumbnails.roblox.com/v1/games/icons?universeIds=${ids}&size=${s}&format=Png&isCircular=false`,
  outfit: (ids, s) => `https://thumbnails.roblox.com/v1/users/outfits?userOutfitIds=${ids}&size=${s}&format=Png&isCircular=false`,
};
async function thumbs(ctx, kind, ids, size = "150x150") {
  const map = {};
  let list = [...new Set(ids.filter(Boolean))];
  list = list.filter((id) => { const c = memoGet(`t:${kind}:${size}:${id}`); if (c) { map[id] = c; return false; } return true; });
  const jobs = [];
  for (let i = 0; i < list.length; i += 100) {
    jobs.push(getJson(ctx, THUMB[kind](list.slice(i, i + 100).join(","), size))
      .then((t) => (t.data || []).forEach((d) => { if (d.imageUrl) { map[d.targetId] = d.imageUrl; memoSet(`t:${kind}:${size}:${d.targetId}`, d.imageUrl); } }))
      .catch(() => {}));
  }
  await Promise.all(jobs);
  return map;
}

async function fillNames(ctx, list) {
  const missing = list.filter((p) => !p.name).map((p) => p.id);
  const byId = {};
  for (let i = 0; i < missing.length; i += 100) {
    const r = await postJson(ctx, "https://users.roblox.com/v1/users", { userIds: missing.slice(i, i + 100), excludeBannedUsers: false }).catch(() => ({ data: [] }));
    (r.data || []).forEach((u) => (byId[u.id] = u));
  }
  return list.map((p) => ({ ...p, name: p.name || byId[p.id]?.name || null, displayName: p.displayName || byId[p.id]?.displayName || byId[p.id]?.name || null }));
}
async function people(ctx, list) {
  const named = await fillNames(ctx, list.map((f) => ({ id: f.id, name: f.name || null, displayName: f.displayName || null, isBanned: !!f.isBanned })));
  const heads = await thumbs(ctx, "head", named.map((p) => p.id));
  return named.map((p) => ({ ...p, icon: heads[p.id] || null }));
}

async function gameStats(ctx, ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const r = await getJson(ctx, `https://games.roblox.com/v1/games?universeIds=${ids.slice(i, i + 50).join(",")}`).catch(() => ({ data: [] }));
    (r.data || []).forEach((g) => (out[g.id] = g));
  }
  return out;
}
async function games(ctx, list) {
  const ids = list.map((g) => g.id);
  const [icons, stats] = await Promise.all([thumbs(ctx, "game", ids), gameStats(ctx, ids)]);
  return list.map((g) => ({
    id: g.id, name: g.name || "Unnamed", rootPlaceId: g.rootPlace?.id || stats[g.id]?.rootPlaceId || null,
    visits: stats[g.id]?.visits ?? g.placeVisits ?? 0, playing: stats[g.id]?.playing ?? 0,
    favorites: stats[g.id]?.favoritedCount ?? null, creator: g.creator?.name || stats[g.id]?.creator?.name || "",
    created: g.created || stats[g.id]?.created || null, updated: stats[g.id]?.updated || g.updated || null,
    icon: icons[g.id] || null,
  }));
}

const PRESENCE = { 0: "Offline", 1: "Online (Website)", 2: "In Game", 3: "In Studio" };

const S = {
  async counts(ctx, id) {
    const c = await Promise.all(["friends", "followers", "followings"].map((k) =>
      getJson(ctx, `https://friends.roblox.com/v1/users/${id}/${k}/count`).then((r) => r.count).catch(() => null)));
    return { friends: c[0], followers: c[1], following: c[2] };
  },
  async presence(ctx, id) {
    const r = await postJson(ctx, "https://presence.roblox.com/v1/presence/users", { userIds: [Number(id)] });
    const p = r.userPresences?.[0] || {};
    const t = p.userPresenceType || 0;
    return {
      type: t, online: t >= 1 && t <= 3, status: PRESENCE[t] || "Offline",
      game: t >= 2 && t <= 3 ? p.lastLocation || null : null, placeId: p.rootPlaceId || null,
      loggedIn: !!ctx.cookie,
    };
  },
  async thumbsHero(ctx, id) {
    const [hd, av] = await Promise.all([thumbs(ctx, "head", [id], "352x352"), thumbs(ctx, "avatar", [id], "420x420")]);
    return { headshot: hd[id] || null, fullBody: av[id] || null };
  },
  async worn(ctx, id) {
    const a = await getJson(ctx, `https://avatar.roblox.com/v1/users/${id}/avatar`);
    const icons = await thumbs(ctx, "asset", (a.assets || []).map((x) => x.id));
    return {
      avatarType: a.playerAvatarType || null,
      items: (a.assets || []).map((x) => ({ id: x.id, name: x.name, assetType: (x.assetType?.name || "Unknown").replace(/([a-z])([A-Z])/g, "$1 $2"), icon: icons[x.id] || null })),
    };
  },
  async outfits(ctx, id) {
    const r = await getJson(ctx, `https://avatar.roblox.com/v2/avatar/users/${id}/outfits?page=1&itemsPerPage=100&isEditable=true`);
    const list = r.data || [];
    const icons = await thumbs(ctx, "outfit", list.map((o) => o.id));
    return { items: list.map((o) => ({ id: o.id, name: o.name || "Unnamed", outfitType: o.outfitType || null, icon: icons[o.id] || null })) };
  },
  async friends(ctx, id) {
    const r = await getJson(ctx, `https://friends.roblox.com/v1/users/${id}/friends`);
    return { items: await people(ctx, r.data || []) };
  },
  async followers(ctx, id) {
    const list = await paged(ctx, `https://friends.roblox.com/v1/users/${id}/followers?limit=100&sortOrder=Desc`, 100);
    return { items: await people(ctx, list) };
  },
  async badges(ctx, id) {
    const list = await paged(ctx, `https://badges.roblox.com/v1/users/${id}/badges?limit=100&sortOrder=Desc`, 150);
    const icons = await thumbs(ctx, "badge", list.map((b) => b.id));
    return {
      items: list.map((b) => ({ id: b.id, name: b.name || "Unnamed Badge", description: b.description || "", awarder: b.awardingUniverse?.name || b.awarder?.name || null, icon: icons[b.id] || null })),
      capped: list.length >= 150,
    };
  },
  async groups(ctx, id) {
    const r = await getJson(ctx, `https://groups.roblox.com/v1/users/${id}/groups/roles`);
    const list = r.data || [];
    const icons = await thumbs(ctx, "group", list.map((g) => g.group?.id));
    return {
      items: list.map((g) => ({
        id: g.group?.id, name: g.group?.name || "Unknown Group", memberCount: g.group?.memberCount || 0,
        roleName: g.role?.name || "Member", roleRank: g.role?.rank || 0, isPrimary: !!g.isPrimaryGroup,
        isOwner: g.group?.owner?.userId === Number(id), verified: !!g.group?.hasVerifiedBadge, icon: icons[g.group?.id] || null,
      })).sort((a, b) => b.isOwner - a.isOwner || b.roleRank - a.roleRank),
    };
  },
  async nameHistory(ctx, id) {
    const list = await paged(ctx, `https://users.roblox.com/v1/users/${id}/username-history?limit=50&sortOrder=Asc`, 200);
    return { items: list.map((e) => e.name).filter(Boolean) };
  },
  async limiteds(ctx, id) {
    const can = await getJson(ctx, `https://inventory.roblox.com/v1/users/${id}/can-view-inventory`).catch(() => null);
    if (can && can.canView === false) return { private: true, items: [], totalRap: 0 };
    const list = await paged(ctx, `https://inventory.roblox.com/v1/users/${id}/assets/collectibles?limit=100&sortOrder=Desc`, 200);
    const icons = await thumbs(ctx, "asset", list.map((c) => c.assetId));
    const items = list.map((c) => ({
      id: c.assetId, name: c.name || "Unknown", serial: c.serialNumber || null,
      rap: Number(c.recentAveragePrice) || 0, originalPrice: c.originalPrice ?? null, icon: icons[c.assetId] || null,
    })).sort((a, b) => b.rap - a.rap);
    return { items, totalRap: items.reduce((n, a) => n + a.rap, 0), capped: list.length >= 200 };
  },
  async favGames(ctx, id) {
    const r = await getJson(ctx, `https://games.roblox.com/v2/users/${id}/favorite/games?limit=50&sortOrder=Desc`);
    return { items: await games(ctx, r.data || []) };
  },
  async myGames(ctx, id) {
    const r = await getJson(ctx, `https://games.roblox.com/v2/users/${id}/games?accessFilter=2&limit=50&sortOrder=Desc`);
    return { items: (await games(ctx, r.data || [])).sort((a, b) => b.visits - a.visits) };
  },
};

async function resolveUser(ctx, input) {
  input = String(input || "").trim();
  const idMatch = input.match(/^(?:id:)?(\d{1,15})$/i);
  if (idMatch && idMatch[1].length >= 4) {
    try { return await getJson(ctx, `https://users.roblox.com/v1/users/${idMatch[1]}`); } catch { /* fall back to name */ }
  }
  if (!/^[A-Za-z0-9_]{3,20}$/.test(input)) throw new Error("Usernames are 3–20 letters, numbers or underscores.");
  const r = await postJson(ctx, "https://users.roblox.com/v1/usernames/users", { usernames: [input], excludeBannedUsers: false });
  const u = r.data?.[0];
  if (!u) throw new Error(`User not found: ${input}`);
  return getJson(ctx, `https://users.roblox.com/v1/users/${u.id}`);
}

function classify(ctx, err) {
  const st = err?.status, m = (err?.robloxMsg || "").toLowerCase();
  if (st === 401) return "login";
  if (st === 403) {
    if (/authorization has been denied|unauthori[sz]ed|token validation|not logged in|authenticat/.test(m)) return "login";
    if (/privacy|private|permission|not allowed to view|cannot view|hidden|inventory/.test(m)) return "private";
    return ctx.cookie ? "private" : "login";
  }
  return "error";
}

// Per-(user, logged-in-or-not) cache, so logged-in and logged-out results never mix.
const cache = new Map();
const CACHE_MS = 5 * 60_000;

async function lookup(ctx, input, { log } = {}) {
  const info = await resolveUser(ctx, input);
  const id = String(info.id);
  const cacheKey = id + (ctx.cookie ? ":auth" : ":anon");
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const keys = Object.keys(S);
  const results = await Promise.allSettled(keys.map((k) => S[k](ctx, id)));
  const sections = {}, errors = {};
  results.forEach((r, i) => {
    const k = keys[i];
    if (r.status === "fulfilled") { sections[k] = r.value; return; }
    const kind = classify(ctx, r.reason);
    if (kind === "private") sections[k] = { private: true, items: [] };
    else if (kind === "login") sections[k] = { needsLogin: true, items: [] };
    else sections[k] = null;
    if (kind !== "private") errors[k] = { kind, message: r.reason?.robloxMsg || r.reason?.message || "Failed", where: r.reason?.where || null, status: r.reason?.status || null };
  });
  if (log) for (const [k, e] of Object.entries(errors)) log(`[${info.name}] ${k}: ${e.kind} (${e.status || "-"} ${e.where || ""}) ${e.message}`);

  const data = {
    info: { id: info.id, name: info.name, displayName: info.displayName, description: info.description || "", created: info.created, isBanned: !!info.isBanned, hasVerifiedBadge: !!info.hasVerifiedBadge },
    ...sections, errors, loggedIn: !!ctx.cookie, fetchedAt: new Date().toISOString(),
  };
  if (!Object.keys(errors).length) cache.set(cacheKey, { at: Date.now(), data });
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  return data;
}

async function outfitDetails(ctx, id) {
  const cached = memoGet("outfit:" + id);
  if (cached) return cached;
  const d = await getJson(ctx, `https://avatar.roblox.com/v1/outfits/${id}/details`);
  const icons = await thumbs(ctx, "asset", (d.assets || []).map((a) => a.id));
  const result = {
    playerAvatarType: d.playerAvatarType || null,
    assets: (d.assets || []).map((a) => ({ id: a.id, name: a.name, assetType: (a.assetType?.name || "Unknown").replace(/([a-z])([A-Z])/g, "$1 $2"), icon: icons[a.id] || null })),
  };
  memoSet("outfit:" + id, result);
  return result;
}

module.exports = { lookup, outfitDetails };
