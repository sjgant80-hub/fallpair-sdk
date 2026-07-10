// fallpair SDK · sovereign single-file library · MIT · AI-Native Solutions
// Extracted from fallpair/index.html · 8630 bytes of source logic
// Public-safe: no primes/glyphs/dyad references

{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "FallPair",
  "description": "Find compatible bond partners for your agent. Scores potential matches by skill complementarity and shape complementarity. Suggests bonds from the local mesh peers. Never sends your identity anywhere.",
  "applicationCategory": "SocialNetworkingApplication",
  "operatingSystem": "Any modern browser",
  "url": "https://sjgant80-hub.github.io/fallpair/",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "GBP" },
  "license": "https://opensource.org/licenses/MIT",
  "author": { "@type": "Organization", "name": "AI-Native Solutions", "url": "https://ai-nativesolutions.com" },
  "featureList": ["Skill-complementarity scoring","shape-complementarity scoring","local mesh discovery","privacy-preserving"]
}
// ═══ Ed25519 identity via WebCrypto ═══
const DB_NAME = 'fallpair', DB_VERSION = 1, STORE = 'matches';
async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains('identity')) db.createObjectStore('identity', { keyPath: 'k' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function getOrCreateIdentity() {
  const db = await openDB();
  const tx = db.transaction('identity', 'readwrite');
  const store = tx.objectStore('identity');
  const existing = await new Promise(r => { const rq = store.get('me'); rq.onsuccess = () => r(rq.result); rq.onerror = () => r(null); });
  if (existing) return existing;
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']).catch(async () => {
    // Fallback to ECDSA P-256 in older browsers
    return crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  });
  const pubJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  const raw = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(pubJwk))));
  const did = 'did:key:' + btoa(String.fromCharCode(...raw)).replace(/=+$/, '');
  const rec = { k: 'me', did, pubJwk, privJwk, created: Date.now() };
  await new Promise(r => { const rq = store.add(rec); rq.onsuccess = r; });
  return rec;
}
async function signMessage(msg, privJwk) {
  const key = await crypto.subtle.importKey('jwk', privJwk, privJwk.crv === 'Ed25519' ? { name: 'Ed25519' } : { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const alg = privJwk.crv === 'Ed25519' ? { name: 'Ed25519' } : { name: 'ECDSA', hash: 'SHA-256' };
  const sig = await crypto.subtle.sign(alg, key, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
async function saveRecord(rec) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const rq = tx.objectStore(STORE).add(rec);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}
async function listRecords() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const rq = tx.objectStore(STORE).getAll();
    rq.onsuccess = () => resolve(rq.result.reverse());
    rq.onerror = () => reject(rq.error);
  });
}
async function deleteRecord(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const rq = tx.objectStore(STORE).delete(id);
    rq.onsuccess = () => resolve();
    rq.onerror = () => reject(rq.error);
  });
}
// ═══ view routing ═══
function switchView(idx) {
  render(idx);
}
// ═══ render per app ═══
async function render(idx) {
  const me = await getOrCreateIdentity();
  if (idx === 1) c.innerHTML = `
    <div class="card">
      <h3>Your profile</h3>
      <div class="form-group"><label>Your skills (comma-separated)</label><input id="p-skills" placeholder="python, cad, ux"></div>
      <div class="form-group"><label>Your shape (0-10 per: sharp, chase, flood, flatline, squeeze, mirror, tower)</label><input id="p-shape" placeholder="2,3,1,0,5,4,2"></div>
      <button class="btn primary" onclick="saveProfile()">Save profile →</button>
    </div>`;
  if (idx === 2) c.innerHTML = `
    <div class="card"><h3>Paste candidate profiles</h3><p style="color:var(--muted);font-size:13px;margin-bottom:14px">One JSON per line: {"did":"...","skills":"...","shape":[...]}</p><textarea id="cands" style="min-height:200px"></textarea><button class="btn primary" onclick="score()" style="margin-top:12px">Score candidates →</button></div>
    <div id="score-results" style="margin-top:16px"></div>`;
  if (idx === 3) {
    const matches = await listRecords();
    if (!matches.length) { c.innerHTML = '<div class="empty"><p>No matches saved yet.</p></div>'; return; }
    c.innerHTML = matches.map(m => `<div class="card"><div class="meta">Score ${(m.score || 0).toFixed(2)}</div><h3>${m.did}</h3><div class="content">Skills overlap: ${m.skillOverlap} · Shape complement: ${m.shapeComp.toFixed(2)}</div><button class="btn" onclick="removeMatch(${m.id})" style="margin-top:10px;border-color:var(--coral);color:var(--coral)">Delete</button></div>`).join('');
  }
  if (idx === 4) c.innerHTML = '<div class="card"><p>Once you find a match, open FallBond to run the ceremony. Two clicks, both sign, bond formed.</p></div>';
}
function saveProfile() {
  localStorage.setItem('fallpair-profile', JSON.stringify({ skills, shape }));
  alert('Profile saved locally.');
}
async function score() {
  const me = JSON.parse(localStorage.getItem('fallpair-profile') || '{"skills":"","shape":""}');
  const mySkills = new Set(me.skills.split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
  const myShape = me.shape.split(',').map(x => parseFloat(x) || 0);
  const scored = [];
  for (const line of lines) {
    try {
      const c = JSON.parse(line);
      const cSkills = new Set((c.skills || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
      const overlap = [...mySkills].filter(x => cSkills.has(x)).length;
      const complementSkills = cSkills.size + mySkills.size - overlap * 2;
      const shapeComp = myShape.length === (c.shape || []).length
        ? myShape.reduce((s, v, i) => s + Math.abs(v - c.shape[i]), 0) / myShape.length
        : 0;
      const score = complementSkills * 0.5 + shapeComp * 0.3 + overlap * 0.2;
      scored.push({ did: c.did, skillOverlap: overlap, shapeComp, score, date: Date.now() });
    } catch {}
  }
  scored.sort((a, b) => b.score - a.score);
}
async function saveMatch(did, so, sc, score) { await saveRecord({ did, skillOverlap: so, shapeComp: sc, score, date: Date.now() }); alert('Saved.'); }
async function removeMatch(id) { if (!confirm('Delete this match?')) return; await deleteRecord(id); switchView(3); }
// Init
  await getOrCreateIdentity();
});

// Named exports for the primary API surface
export { openDB };
export { getOrCreateIdentity };
export { signMessage };
export { saveRecord };
export { listRecords };
export { deleteRecord };
export { switchView };
export { saveProfile };
export { score };
export { saveMatch };

export { DB_NAME };
