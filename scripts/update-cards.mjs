#!/usr/bin/env node
/**
 * Keeps public/data/cards.json — the card database the app searches — current
 * with pokemontcg.io, plus the promos only TCGdex has.
 *
 *   npm run cards                    add sets released since the last run, fill
 *                                    missing promos from TCGdex, and refresh every
 *                                    set's name, code and legality
 *   npm run cards -- --check         list what's missing without downloading
 *   npm run cards -- --sets=me5,me4  re-download specific sets
 *   npm run cards -- --full          re-download every card (~20k, a while)
 *
 * Set POKEMONTCG_API_KEY (free at https://pokemontcg.io) for higher rate
 * limits. The API fails intermittently, so every request is retried with
 * backoff and the file is saved after each set: an interrupted run keeps what
 * it fetched, and running it again picks up the rest.
 *
 * The file is compact on purpose — about a quarter of the API's size. Image
 * URLs and collector numbers are only stored when they can't be derived from
 * the card id, and set details live once on the set. See CompactCard and
 * CompactSet in src/lib/cardDb.ts for the format.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

const OUT = 'public/data/cards.json';
const API = 'https://api.pokemontcg.io/v2';
const TCGDEX = 'https://api.tcgdex.net/v2/en';
const PAGE_SIZE = 250;
const API_KEY = process.env.POKEMONTCG_API_KEY;
const PAUSE_MS = API_KEY ? 50 : 400;

// Keep in step with DEFAULT_IMAGE_URL in src/lib/cardDb.ts. A set whose art
// lives elsewhere records its own pattern.
const DEFAULT_IMAGE_URL = 'https://images.pokemontcg.io/{set}/{number}.png';
const IMAGE_URLS = [DEFAULT_IMAGE_URL, 'https://images.scrydex.com/pokemon/{id}/small'];

const SUPERTYPES = { 'Pokémon': 'P', Trainer: 'T', Energy: 'E' };

/**
 * Promo sets pokemontcg.io lacks entirely (mep, mee) or is missing cards from
 * (svp, swshp), filled in from TCGdex, which uses the same set ids. The names
 * are for when pokemontcg.io doesn't have the set at all.
 */
const TCGDEX_SETS = {
  svp: 'Scarlet & Violet Black Star Promos',
  swshp: 'SWSH Black Star Promos',
  mep: 'Mega Evolution Black Star Promos',
  mee: 'Mega Evolution Energy',
};

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const full = args.includes('--full');
const only = args
  .find((arg) => arg.startsWith('--sets='))
  ?.slice('--sets='.length)
  .split(',')
  .filter(Boolean);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const today = () => new Date().toISOString().slice(0, 10);
const setIdOf = (cardId) => cardId.slice(0, cardId.lastIndexOf('-'));

async function fetchJson(url, { headers = {}, isValid }) {
  let lastError;
  for (let attempt = 0; attempt < 7; attempt++) {
    if (attempt > 0) {
      const wait = 2 ** attempt;
      console.log(`    ${lastError} — retrying in ${wait}s`);
      await sleep(wait * 1000);
    }
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', ...headers },
        signal: AbortSignal.timeout(90_000),
      });
      // Nothing to retry: the thing isn't there.
      if (response.status === 404) throw Object.assign(new Error('HTTP 404'), { final: true });
      // A 5xx usually clears on its own. Its body can be JSON too, just not the data.
      const body = response.ok ? await response.json() : undefined;
      if (body !== undefined && isValid(body)) return body;
      lastError = response.ok ? 'unexpected response' : `HTTP ${response.status}`;
    } catch (error) {
      if (error.final) throw new Error(`${url}: ${error.message}`);
      lastError = error.message;
    }
  }
  throw new Error(`${url} failed: ${lastError}`);
}

const get = (path, params) =>
  fetchJson(`${API}${path}?${new URLSearchParams(params)}`, {
    headers: API_KEY ? { 'X-Api-Key': API_KEY } : {},
    isValid: (body) => Array.isArray(body?.data),
  });

const tcgdex = (path) => fetchJson(`${TCGDEX}${path}`, { isValid: (body) => typeof body?.id === 'string' });

// Where pokemontcg.io keeps its newer art, under the same card ids.
const SCRYDEX = 'https://images.scrydex.com/pokemon';
let scrydexPlaceholder;

async function imageHash(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) return undefined;
  return createHash('md5').update(Buffer.from(await response.arrayBuffer())).digest('hex');
}

/**
 * Art for a card filled in from TCGdex: TCGdex's own if it has some, else
 * Scrydex's. Scrydex answers an id it has no art for with a card back rather
 * than a 404, so its image only counts if it isn't that one.
 */
async function artFor(cardId, tcgdexImage) {
  if (tcgdexImage) return `${tcgdexImage}/low.png`;
  try {
    scrydexPlaceholder ??= await imageHash(`${SCRYDEX}/zzz-not-a-card/small`);
    const url = `${SCRYDEX}/${cardId}/small`;
    const hash = await imageHash(url);
    return hash && scrydexPlaceholder && hash !== scrydexPlaceholder ? url : undefined;
  } catch {
    return undefined; // Tried again on the next run.
  }
}

async function fetchSets() {
  const sets = [];
  for (let page = 1; ; page++) {
    const body = await get('/sets', { page: String(page), pageSize: String(PAGE_SIZE) });
    sets.push(...body.data);
    if (!body.data.length || sets.length >= (body.totalCount ?? sets.length)) break;
  }
  return sets.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
}

async function fetchSetCards(setId) {
  const cards = [];
  for (let page = 1; ; page++) {
    const body = await get('/cards', {
      q: `set.id:${setId}`,
      page: String(page),
      pageSize: String(PAGE_SIZE),
      select: 'id,name,number,set,images,supertype,subtypes,regulationMark',
    });
    cards.push(...body.data);
    if (!body.data.length || cards.length >= (body.totalCount ?? cards.length)) return cards;
    await sleep(PAUSE_MS);
  }
}

/** A set's name, release date, legality and code, in the compact format. */
function setRecord(remote, previous) {
  const record = { n: remote.name, d: remote.releaseDate };
  // Letters for the formats the set is legal in. No `l` at all means "no
  // legality data", which the app treats differently from "legal nowhere".
  const legal = remote.legalities;
  if (legal) {
    record.l = ['standard', 'expanded', 'unlimited']
      .filter((format) => legal[format] === 'Legal')
      .map((format) => format[0])
      .join('');
  }
  if (remote.ptcgoCode) record.c = remote.ptcgoCode;
  if (previous?.m) record.m = previous.m;
  return record;
}

/** A set's cards in the compact format, plus the image URL pattern most of them follow. */
function compactSet(setId, setName, raw) {
  const fill = (pattern, card) =>
    pattern.replace('{set}', setId).replace('{number}', card.number).replace('{id}', card.id);
  // Stable sort, so a tie goes to the default pattern and nothing is stored.
  const imageUrl = IMAGE_URLS.map((pattern) => ({
    pattern,
    hits: raw.filter((card) => card.images?.small === fill(pattern, card)).length,
  })).sort((a, b) => b.hits - a.hits)[0].pattern;

  const cards = [];
  for (const card of raw) {
    const type = SUPERTYPES[card.supertype];
    if (!type || setIdOf(card.id) !== setId) {
      console.log(`    skipping ${card.id} (${card.supertype ?? 'no supertype'})`);
      continue;
    }
    const compact = { i: card.id, n: card.name, t: type };
    if (card.subtypes?.length) compact.s = card.subtypes;
    if (card.regulationMark) compact.r = card.regulationMark;
    if (card.number !== card.id.slice(setId.length + 1)) compact.u = card.number;
    if (card.images?.small && card.images.small !== fill(imageUrl, card)) compact.m = card.images.small;
    if (card.set?.name && card.set.name !== setName) compact.x = card.set.name;
    cards.push(compact);
  }
  return { imageUrl, cards };
}

// ── TCGdex ──────────────────────────────────────────────────────────────────

/** "031" → "31"; "SWSH299" stays as it is. */
const tcgdexNumber = (localId) => (/^\d+$/.test(localId) ? String(Number(localId)) : localId);

/** TCGdex's stage, trainer type and energy type, named as pokemontcg.io names them. */
function tcgdexSubtypes(card) {
  if (card.category === 'Pokemon') return card.stage ? [card.stage.replace(/^Stage(\d)$/, 'Stage $1')] : [];
  if (card.category === 'Trainer') return card.trainerType ? [card.trainerType === 'Tool' ? 'Pokémon Tool' : card.trainerType] : [];
  if (card.category === 'Energy') return card.energyType ? [card.energyType === 'Normal' ? 'Basic' : card.energyType] : [];
  return [];
}

/**
 * A TCGdex card in the compact format. The id follows pokemontcg.io's
 * convention — "mep-31", not TCGdex's "mep-031" — so a card pokemontcg.io
 * adds later lands on the same id instead of beside it.
 */
function compactTcgdexCard(setId, card) {
  const type = { Pokemon: 'P', Trainer: 'T', Energy: 'E' }[card.category];
  if (!type) return undefined;
  const compact = { i: `${setId}-${tcgdexNumber(card.localId)}`, n: card.name, t: type };
  const subtypes = tcgdexSubtypes(card);
  if (subtypes.length) compact.s = subtypes;
  if (card.regulationMark) compact.r = card.regulationMark;
  return compact;
}

/**
 * Adds the TCGDEX_SETS cards the file doesn't have yet, and art TCGdex has
 * added since a card was filled in. With [dryRun], only reports.
 */
async function fillFromTcgdex(data, { dryRun = false } = {}) {
  const failed = [];
  let added = 0;
  for (const [setId, name] of Object.entries(TCGDEX_SETS)) {
    try {
      const listing = await tcgdex(`/sets/${setId}`);
      const ours = new Map(
        data.cards.filter((card) => setIdOf(card.i) === setId).map((card) => [card.i.slice(setId.length + 1).toUpperCase(), card]),
      );
      const listed = (listing.cards ?? []).map((card) => ({ ...card, key: tcgdexNumber(card.localId).toUpperCase() }));
      const missing = listed.filter((card) => !ours.has(card.key));

      if (dryRun) {
        if (missing.length) console.log(`  ${setId}: ${missing.length} cards to add from TCGdex`);
        continue;
      }

      // Art for cards filled in before any could be found.
      let newArt = 0;
      for (const card of listed) {
        const existingCard = ours.get(card.key);
        if (existingCard?.m !== '') continue;
        const art = await artFor(existingCard.i, card.image);
        if (art) {
          existingCard.m = art;
          newArt++;
        }
      }

      const cards = [];
      let standard = false;
      let expanded = false;
      for (const card of missing) {
        const detail = await tcgdex(`/cards/${encodeURIComponent(card.id)}`);
        const compact = compactTcgdexCard(setId, detail);
        if (!compact) {
          console.log(`    skipping ${card.id} (${detail.category ?? 'no category'})`);
          continue;
        }
        // No art anywhere yet: an empty URL shows a placeholder, where the
        // set's pattern would point at an image that doesn't exist.
        compact.m = (await artFor(compact.i, detail.image)) ?? '';
        cards.push(compact);
        standard ||= detail.legal?.standard === true;
        expanded ||= detail.legal?.expanded === true;
        await sleep(100);
      }
      if (!cards.length && !newArt) continue;

      if (!data.sets[setId] && cards.length) {
        // TCGdex's set-level legality lags its cards' — it lists MEP as not
        // Standard-legal — so a new set takes its legality from its cards.
        data.sets[setId] = {
          n: name,
          d: listing.releaseDate.replaceAll('-', '/'),
          l: `${standard ? 's' : ''}${expanded ? 'e' : ''}u`,
          ...(listing.abbreviation?.official ? { c: listing.abbreviation.official } : {}),
        };
      }
      data.cards = [...data.cards, ...cards];
      if (cards.length) data.updatedAt = today();
      save(data);
      added += cards.length;
      console.log(`  ${setId}: ${cards.length} cards added${newArt ? `, art for ${newArt} more` : ''}`);
    } catch (error) {
      failed.push(setId);
      console.log(`  ${setId}: FAILED (${error.message})`);
    }
  }
  return { added, failed };
}

// ── Saving ──────────────────────────────────────────────────────────────────

/**
 * Lends a Trainer subtype to printings that carry none. Trainers printed
 * before the Item/Supporter/Stadium split (Base Set through the e-Card era)
 * just say "Trainer", so they'd otherwise group under "Other". Which kind of
 * Trainer a card is belongs to the card rather than one printing of it, so the
 * newest printing that has a subtype lends it to those that don't.
 */
function backfillTrainerSubtypes(cards, sets) {
  const donors = new Map();
  for (const card of cards) {
    if (card.t !== 'T' || !card.s?.length) continue;
    const key = card.n.toLowerCase();
    const released = sets[setIdOf(card.i)]?.d ?? '';
    const current = donors.get(key);
    if (!current || released > current.released) donors.set(key, { released, subtypes: card.s });
  }
  for (const card of cards) {
    if (card.t !== 'T' || card.s?.length) continue;
    const donor = donors.get(card.n.toLowerCase());
    if (donor) card.s = donor.subtypes;
  }
}

function save(data) {
  backfillTrainerSubtypes(data.cards, data.sets);
  const sets = Object.fromEntries(Object.entries(data.sets).sort(([, a], [, b]) => a.d.localeCompare(b.d)));
  // Written to a temp file first so an interrupted write can't corrupt the data.
  const tmp = `${OUT}.tmp`;
  writeFileSync(tmp, JSON.stringify({ version: 2, updatedAt: data.updatedAt, sets, cards: data.cards }));
  renameSync(tmp, OUT);
}

// ── Run ─────────────────────────────────────────────────────────────────────

const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { sets: {}, cards: [] };
const data = { sets: { ...existing.sets }, cards: existing.cards, updatedAt: existing.updatedAt ?? today() };

console.log('Fetching the set list from pokemontcg.io…');
const remote = await fetchSets();
const newSets = remote.filter((set) => !existing.sets[set.id]);

if (checkOnly) {
  console.log(`${remote.length} sets on pokemontcg.io, ${Object.keys(existing.sets).length} in ${OUT}.`);
  if (!newSets.length) {
    console.log('No new sets on pokemontcg.io.');
  } else {
    console.log(`${newSets.length} new:`);
    for (const set of newSets) console.log(`  ${set.releaseDate}  ${set.id.padEnd(12)} ${(set.ptcgoCode ?? '').padEnd(6)} ${set.name}`);
  }
  console.log('Checking TCGdex for missing promos…');
  await fillFromTcgdex(data, { dryRun: true });
  console.log('Run `npm run cards` to add anything listed.');
  process.exit(0);
}

if (only) {
  const unknown = only.filter((id) => !remote.some((set) => set.id === id));
  if (unknown.length) {
    console.error(`pokemontcg.io has no set with id: ${unknown.join(', ')}`);
    process.exit(1);
  }
}

// Names, codes and legality change after release — rotation, mostly — so
// they're refreshed for every set the file already has.
for (const set of remote) {
  if (data.sets[set.id]) data.sets[set.id] = setRecord(set, data.sets[set.id]);
}
save(data);
console.log(`Refreshed details for ${remote.length - newSets.length} sets.`);

const toDownload = full ? remote : only ? remote.filter((set) => only.includes(set.id)) : newSets;
const failed = [];
let downloaded = 0;
if (toDownload.length) console.log(`Downloading ${toDownload.length} set(s)…`);
for (const [index, set] of toDownload.entries()) {
  const label = `  [${index + 1}/${toDownload.length}] ${set.id} — ${set.name}`;
  try {
    const raw = await fetchSetCards(set.id);
    if (!raw.length) throw new Error('came back empty');
    const { imageUrl, cards } = compactSet(set.id, set.name, raw);
    // A set only joins the file once its cards are in, so a failed new set is
    // simply picked up again on the next run.
    const record = setRecord(set);
    if (imageUrl !== DEFAULT_IMAGE_URL) record.m = imageUrl;
    data.sets[set.id] = record;
    data.cards = [...data.cards.filter((card) => setIdOf(card.i) !== set.id), ...cards];
    data.updatedAt = today();
    save(data);
    downloaded += cards.length;
    console.log(`${label}: ${cards.length} cards`);
  } catch (error) {
    failed.push(set.id);
    console.log(`${label}: FAILED (${error.message})`);
  }
  await sleep(PAUSE_MS);
}

console.log('Filling promos pokemontcg.io is missing from TCGdex…');
const tcgdexResult = await fillFromTcgdex(data);

console.log(
  `\nSaved ${OUT}: ${data.cards.length} cards in ${Object.keys(data.sets).length} sets ` +
    `(${downloaded} from pokemontcg.io, ${tcgdexResult.added} from TCGdex).`,
);
if (failed.length) {
  console.log(`${failed.length} set(s) failed: ${failed.join(', ')}. Retry them with: npm run cards -- --sets=${failed.join(',')}`);
}
if (tcgdexResult.failed.length) {
  console.log(`TCGdex failed for: ${tcgdexResult.failed.join(', ')}. Run \`npm run cards\` again to retry.`);
}
if (failed.length || tcgdexResult.failed.length) process.exit(1);
