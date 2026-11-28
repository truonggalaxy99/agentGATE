/**
 * Soft Ref v2 ledger (AgentGate).
 * In-memory + optional durable JSON via REF_LEDGER_URL (GET returns JSON, PUT saves JSON).
 *
 * Rules (soft / experimental — no promised returns):
 * - +100 points to referrer per unique invitee checkIn (cap 50 invites / ref)
 * - Milestone bonuses at 1 / 3 / 5 / 10 invites
 * - Invitee welcome +50 once (soft points)
 * - Redeem: 100 points → 1 AGPULSE trial (off-chain balance)
 */

const POINT_PER_CHECKIN = 100;
const WELCOME_BONUS = 50;
const REDEEM_COST = 100;
const MAX_PER_REF = 50;
const MILESTONES = [
  { at: 1, bonus: 0, id: "first" },
  { at: 3, bonus: 50, id: "scout" },
  { at: 5, bonus: 100, id: "radar" },
  { at: 10, bonus: 200, id: "refscout" }
];

const BLURB = "Điểm ref có thể đổi thành AGPULSE thử nghiệm.";

function emptyDb() {
  return {
    credits: Object.create(null), // handle -> points
    agpulse: Object.create(null), // handle -> trial units
    seen: Object.create(null), // inviteeAddress -> refHandle
    welcome: Object.create(null), // inviteeHandle -> 1
    milestonesAwarded: Object.create(null), // `${ref}:${at}` -> 1
    ledger: [],
    redeems: []
  };
}

function store() {
  if (!globalThis.__AG_REF_LEDGER__) {
    globalThis.__AG_REF_LEDGER__ = emptyDb();
  }
  return globalThis.__AG_REF_LEDGER__;
}

function hydrate(raw) {
  const db = emptyDb();
  if (!raw || typeof raw !== "object") return db;
  Object.assign(db.credits, raw.credits || {});
  Object.assign(db.agpulse, raw.agpulse || {});
  Object.assign(db.seen, raw.seen || {});
  Object.assign(db.welcome, raw.welcome || {});
  Object.assign(db.milestonesAwarded, raw.milestonesAwarded || {});
  db.ledger = Array.isArray(raw.ledger) ? raw.ledger.slice(-500) : [];
  db.redeems = Array.isArray(raw.redeems) ? raw.redeems.slice(-500) : [];
  return db;
}

function serialize(db) {
  return {
    credits: { ...db.credits },
    agpulse: { ...db.agpulse },
    seen: { ...db.seen },
    welcome: { ...db.welcome },
    milestonesAwarded: { ...db.milestonesAwarded },
    ledger: db.ledger.slice(-500),
    redeems: db.redeems.slice(-500)
  };
}

async function loadDurable() {
  const url = (process.env.REF_LEDGER_URL || "").trim();
  if (!url) return;
  if (globalThis.__AG_REF_LOADED__) return;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.ok) {
      const raw = await res.json();
      globalThis.__AG_REF_LEDGER__ = hydrate(raw.data || raw);
    }
  } catch (_) {}
  globalThis.__AG_REF_LOADED__ = true;
}

async function saveDurable(db) {
  const url = (process.env.REF_LEDGER_URL || "").trim();
  if (!url) return;
  try {
    await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serialize(db))
    });
  } catch (_) {}
}

function normHandle(h) {
  let s = String(h || "").trim().toLowerCase();
  if (!s) return "";
  if (s.startsWith("@")) s = s.slice(1);
  if (!s.endsWith(".ai")) s = `${s}.ai`;
  const base = s.replace(/\.ai$/, "");
  if (!/^[a-z0-9]{3,15}$/.test(base)) return "";
  return `${base}.ai`;
}

function normAddr(a) {
  const s = String(a || "").trim().toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(s) ? s : "";
}

function inviteCountOf(db, ref) {
  return Object.values(db.seen).filter((r) => r === ref).length;
}

function topList(credits, n = 8) {
  return Object.entries(credits)
    .map(([ref, points]) => ({
      ref,
      points,
      agpulse: 0
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, n);
}

function milestonesFor(db, ref, invites) {
  return MILESTONES.map((m) => ({
    at: m.at,
    bonus: m.bonus,
    id: m.id,
    hit: invites >= m.at,
    awarded: !!db.milestonesAwarded[`${ref}:${m.at}`]
  }));
}

function applyMilestones(db, ref) {
  const invites = inviteCountOf(db, ref);
  let gained = 0;
  const hit = [];
  for (const m of MILESTONES) {
    if (invites < m.at) continue;
    const key = `${ref}:${m.at}`;
    if (db.milestonesAwarded[key]) continue;
    db.milestonesAwarded[key] = 1;
    if (m.bonus > 0) {
      db.credits[ref] = (db.credits[ref] || 0) + m.bonus;
      gained += m.bonus;
    }
    hit.push(m.at);
  }
  return { gained, hit, invites };
}

function publicPayload(db, ref) {
  const invites = ref ? inviteCountOf(db, ref) : 0;
  const top = topList(db.credits).map((row) => ({
    ...row,
    agpulse: db.agpulse[row.ref] || 0
  }));
  return {
    ok: true,
    pointPerCheckIn: POINT_PER_CHECKIN,
    welcomeBonus: WELCOME_BONUS,
    redeemCost: REDEEM_COST,
    maxPerRef: MAX_PER_REF,
    milestones: milestonesFor(db, ref || "_", invites),
    points: ref ? db.credits[ref] || 0 : 0,
    inviteCount: invites,
    agpulseTrial: ref ? db.agpulse[ref] || 0 : 0,
    top,
    recentRedeems: ref
      ? db.redeems.filter((r) => r.ref === ref).slice(-5).reverse()
      : [],
    blurb: BLURB
  };
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  await loadDurable();
  const db = store();

  if (req.method === "GET") {
    const ref = normHandle(req.query?.ref || "");
    return json(res, 200, publicPayload(db, ref));
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "method" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch (_) {
      body = {};
    }
  }
  body = body || {};
  const action = String(body.action || "credit").toLowerCase();

  if (action === "redeem") {
    const ref = normHandle(body.ref);
    if (!ref) return json(res, 400, { ok: false, error: "bad_params" });
    const pts = db.credits[ref] || 0;
    if (pts < REDEEM_COST) {
      return json(res, 400, {
        ok: false,
        error: "insufficient",
        points: pts,
        redeemCost: REDEEM_COST
      });
    }
    db.credits[ref] = pts - REDEEM_COST;
    db.agpulse[ref] = (db.agpulse[ref] || 0) + 1;
    db.redeems.push({
      at: new Date().toISOString(),
      ref,
      cost: REDEEM_COST,
      units: 1,
      balance: db.agpulse[ref]
    });
    if (db.redeems.length > 500) db.redeems = db.redeems.slice(-500);
    await saveDurable(db);
    return json(res, 200, {
      ...publicPayload(db, ref),
      redeemed: true,
      creditedAgpulse: 1
    });
  }

  if (action === "welcome") {
    const inviteeHandle = normHandle(body.inviteeHandle || body.ref || "");
    if (!inviteeHandle) return json(res, 400, { ok: false, error: "bad_params" });
    if (db.welcome[inviteeHandle]) {
      return json(res, 200, {
        ...publicPayload(db, inviteeHandle),
        duplicate: true
      });
    }
    db.welcome[inviteeHandle] = 1;
    db.credits[inviteeHandle] = (db.credits[inviteeHandle] || 0) + WELCOME_BONUS;
    db.ledger.push({
      at: new Date().toISOString(),
      type: "welcome",
      ref: inviteeHandle,
      points: WELCOME_BONUS
    });
    await saveDurable(db);
    return json(res, 200, {
      ...publicPayload(db, inviteeHandle),
      welcome: WELCOME_BONUS
    });
  }

  // default: credit referrer
  const ref = normHandle(body.ref);
  const invitee = normAddr(body.invitee);
  const inviteeHandle = normHandle(body.inviteeHandle || "");
  if (!ref || !invitee) {
    return json(res, 400, { ok: false, error: "bad_params" });
  }
  if (inviteeHandle && inviteeHandle === ref) {
    return json(res, 400, { ok: false, error: "self_ref" });
  }

  if (db.seen[invitee]) {
    return json(res, 200, {
      ...publicPayload(db, ref),
      duplicate: true
    });
  }

  const currentCount = inviteCountOf(db, ref);
  if (currentCount >= MAX_PER_REF) {
    return json(res, 400, { ok: false, error: "cap" });
  }

  db.seen[invitee] = ref;
  db.credits[ref] = (db.credits[ref] || 0) + POINT_PER_CHECKIN;
  db.ledger.push({
    at: new Date().toISOString(),
    type: "credit",
    ref,
    invitee,
    inviteeHandle: inviteeHandle || null,
    points: POINT_PER_CHECKIN
  });
  if (db.ledger.length > 500) db.ledger = db.ledger.slice(-500);

  const ms = applyMilestones(db, ref);

  let welcomePts = 0;
  if (inviteeHandle && !db.welcome[inviteeHandle]) {
    db.welcome[inviteeHandle] = 1;
    db.credits[inviteeHandle] = (db.credits[inviteeHandle] || 0) + WELCOME_BONUS;
    welcomePts = WELCOME_BONUS;
    db.ledger.push({
      at: new Date().toISOString(),
      type: "welcome",
      ref: inviteeHandle,
      points: WELCOME_BONUS
    });
  }

  await saveDurable(db);
  return json(res, 200, {
    ...publicPayload(db, ref),
    credited: POINT_PER_CHECKIN,
    milestoneBonus: ms.gained,
    milestonesJustHit: ms.hit,
    welcomeToInvitee: welcomePts
  });
};
