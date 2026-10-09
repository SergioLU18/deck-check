import fontkit from '@pdf-lib/fontkit';
import { LineCapStyle, PDFDocument, rgb, type Color, type PDFFont, type PDFPage } from 'pdf-lib';
import { nameKey, plainApostrophes, setIdOf, type CardDatabase } from './cardDb';
import { isPokemon } from './deck';
import type { AgeDivision, DeckCard, Player } from './types';

/**
 * Fills a deck onto the official Play! Pokémon deck list.
 *
 * The form is a flat, non-fillable PDF. Its page is embedded as-is — still
 * vector, still the official artwork — and the deck is drawn over it as real
 * text. Every coordinate below is in PDF points measured from the top-left of
 * the US Letter page, read straight off the source document; Painter flips
 * them into PDF's bottom-left space.
 */

export interface DeckListAssets {
  /** public/form/play-pokemon-deck-list.pdf */
  form: ArrayBuffer | Uint8Array;
  font: ArrayBuffer | Uint8Array;
  boldFont: ArrayBuffer | Uint8Array;
}

export interface DeckListOptions {
  cards: DeckCard[];
  deckName: string;
  player: Player;
  /** "Standard" or "Expanded" checks that box; anything else leaves both blank. */
  format: string;
  division?: AgeDivision;
  db: CardDatabase;
  assets: DeckListAssets;
}

export interface DeckListPdfResult {
  bytes: Uint8Array;
  pageCount: number;
  /** Cards that couldn't be typed, listed on the Trainer table as a fallback. */
  unclassified: string[];
  /** Pokémon whose SET and COLL. # columns were left blank. */
  missingSetInfo: string[];
  /** Pokémon whose REG column was left blank. */
  missingRegulationMark: string[];
}

export interface DeckListEntry {
  quantity: number;
  name: string;
  setCode?: string;
  number?: string;
  regulationMark?: string;
}

export interface DeckListSections {
  pokemon: DeckListEntry[];
  trainer: DeckListEntry[];
  energy: DeckListEntry[];
  unclassified: string[];
  missingSetInfo: string[];
  missingRegulationMark: string[];
}

/**
 * Card names carry a few symbols the bundled font has no glyph for. The list
 * only needs the card named unambiguously, so they're written the way players
 * and judges say them. Greek letters are in the font and print as-is.
 */
const NAME_SUBSTITUTIONS: [string, string][] = [
  ['♀', 'F'], // Nidoran ♀
  ['♂', 'M'], // Nidoran ♂
  ['◇', 'Prism Star'], // Victini ◇
  ['★', 'Star'], // Espeon ★ and the other EX-era Gold Stars
];

/**
 * Sets released before this predate every set the form lists, which is what
 * its "put NA as the set name" instruction is about. Black & White — the
 * oldest set on the sheet — released 2011/04/25.
 */
const OLDEST_LISTED_SET_DATE = '2011/04/25';

/**
 * Regulation marks started with Sword & Shield; its Black Star Promos were the
 * first set to carry them. A print from before then has none to write, so a
 * blank REG column is correct for it, not something to warn about.
 */
const FIRST_REGULATION_MARK_DATE = '2019/11/15';

/** What the form wants in SET for a card older than anything it lists. */
const NOT_APPLICABLE = 'NA';

/**
 * Promo sets, written the way the form's own legend writes them: the older
 * Black Star Promos are all "PR", the newer ones have codes of their own.
 */
const FORM_SET_CODES: Record<string, string> = {
  bwp: 'PR',
  xyp: 'PR',
  smp: 'PR',
  swshp: 'PR',
  svp: 'SVP',
  mep: 'MEP',
};

// ── Page geometry (PDF points, top-left origin) ────────────────────────────

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

/**
 * Height of one ruled row, and of the section-heading and column-label bands
 * above each table — the form uses the same measure for all three.
 */
const ROW_HEIGHT = 13.12;

/** Top of the Pokémon section heading, and the white space between tables. */
const TABLE_TOP = 169.2;
const GAP_AFTER_POKEMON = 18.8;
const GAP_AFTER_TRAINER = 19.6;

// Row counts as printed on the form.
const STOCK_POKEMON_ROWS = 10;
const STOCK_TRAINER_ROWS = 18;
const STOCK_ENERGY_ROWS = 4;

/**
 * Rows that fit between TABLE_TOP and the bottom of the Energy table. The
 * space is fixed, so this is the most one sheet holds however it's divided.
 */
const TOTAL_ROW_BUDGET = STOCK_POKEMON_ROWS + STOCK_TRAINER_ROWS + STOCK_ENERGY_ROWS;

// Column edges, shared by all three tables.
const QTY_LEFT = 257.7;
const QTY_RIGHT = 294.1;
const NAME_LEFT = 294.1;
const SET_LEFT = 465.4;
const COLL_LEFT = 502.4;
const REG_LEFT = 539.5;
const TABLE_RIGHT = 576.0;

// Header fields.
const HEADER_FIELD_TOP = 68.5;
const HEADER_FIELD_HEIGHT = 12.0;
const PLAYER_NAME = [88.9, 234.4] as const;
const PLAYER_ID = [276.6, 371.9] as const;
const DOB_MONTH = [488.6, 509.4] as const;
const DOB_DAY = [518.0, 536.9] as const;
const DOB_YEAR = [544.0, 575.4] as const;

// Checkboxes, as the printed square's own ink bounds so the X lands inside.
const FORMAT_BOX_TOP = 46.83;
const FORMAT_BOX_SIZE = 6.8;
const STANDARD_BOX_LEFT = 156.3;
const EXPANDED_BOX_LEFT = 206.1;

const DIVISION_BOX_LEFT = 375.57;
const DIVISION_BOX_SIZE = 6.25;
const DIVISION_BOX_TOPS: Record<AgeDivision, number> = {
  junior: 109.88,
  senior: 123.38,
  masters: 136.88,
};

// "Sheet 1 of 2", in the empty margin right of the season title.
const SHEET_LABEL_RIGHT = 576.0;
const SHEET_LABEL_TOP = 27.0;

// Table chrome, sampled from the form so a redrawn table matches the printed
// one. Rows are a flat light grey separated by hairline white rules.
const SECTION_BAND_COLOR = rgb(0.6553, 0.6636, 0.6735);
const LABEL_BAND_COLOR = rgb(0.1367, 0.122, 0.1253);
const ROW_COLOR = rgb(0.9478, 0.9497, 0.9516);
const SECTION_TEXT_COLOR = rgb(0.1373, 0.1216, 0.1255);
const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0, 0, 0);
const RULE_WIDTH = 1.0;

const SECTION_NAME_LEFT = 262.7;
const LABEL_INSET = 1.1; // band top → text top, as printed

const ROW_FONT_SIZE = 8.5;
const HEADER_FONT_SIZE = 10.0;
const SHEET_LABEL_FONT_SIZE = 9.0;
const TABLE_LABEL_FONT_SIZE = 9.0;

// ── Table layout ────────────────────────────────────────────────────────────

/**
 * Where one of the three card tables sits and how many ruled rows it has. A
 * table is a heading band, a column-label band, then the rows.
 */
export interface TableLayout {
  headerTop: number;
  rows: number;
  labelsTop: number;
  firstRowTop: number;
  bottom: number;
}

/**
 * The three tables for one sheet. The form prints 10 Pokémon rows, 18 Trainer
 * and 4 Energy. A lopsided deck — twenty Pokémon, five Trainers — overflows
 * one table while leaving another half empty, and would need a second sheet
 * for no good reason. Then the tables are re-proportioned and redrawn over the
 * printed ones; the row budget is fixed, so rows only ever move between tables.
 */
export interface DeckListLayout {
  pokemon: TableLayout;
  trainer: TableLayout;
  energy: TableLayout;
  /** True when the tables differ from the printed ones and are painted over them. */
  redrawn: boolean;
}

function table(headerTop: number, rows: number): TableLayout {
  const firstRowTop = headerTop + ROW_HEIGHT * 2;
  return {
    headerTop,
    rows,
    labelsTop: headerTop + ROW_HEIGHT,
    firstRowTop,
    bottom: firstRowTop + rows * ROW_HEIGHT,
  };
}

/** The tables exactly as printed on the form. */
const STOCK_LAYOUT: DeckListLayout = {
  pokemon: table(TABLE_TOP, STOCK_POKEMON_ROWS),
  trainer: table(345.4, STOCK_TRAINER_ROWS),
  energy: table(627.3, STOCK_ENERGY_ROWS),
  redrawn: false,
};

/**
 * Picks the table sizes for a deck. The printed form is left alone whenever
 * the deck fits it. Resizing only happens when it turns a two-sheet deck into
 * a one-sheet deck — if the deck needs more rows than a sheet holds either
 * way, there's nothing to gain and the official artwork is worth more.
 */
export function layoutFor(counts: { pokemon: number; trainer: number; energy: number }): DeckListLayout {
  const { pokemon, trainer, energy } = counts;
  if (pokemon <= STOCK_POKEMON_ROWS && trainer <= STOCK_TRAINER_ROWS && energy <= STOCK_ENERGY_ROWS) {
    return STOCK_LAYOUT;
  }
  if (pokemon + trainer + energy > TOTAL_ROW_BUDGET) return STOCK_LAYOUT;
  return allocate(pokemon, trainer, energy);
}

/**
 * Gives each table the rows it needs, then shares out what's left so the
 * tables still reach the bottom of the page instead of stopping short.
 */
function allocate(pokemon: number, trainer: number, energy: number): DeckListLayout {
  // Every table keeps at least one row: an empty one reads as a mistake, and
  // leaves nowhere to write a forgotten card by hand.
  const rows = [Math.max(pokemon, 1), Math.max(trainer, 1), Math.max(energy, 1)];
  let spare = TOTAL_ROW_BUDGET - rows.reduce((a, b) => a + b, 0);

  // Every table gets a blank line first, then the rest is shared out.
  if (spare >= rows.length) {
    for (let i = 0; i < rows.length; i++) rows[i] += 1;
    spare -= rows.length;
  }

  if (spare > 0) {
    // In the form's own 10:18:4 proportion.
    const weights = [STOCK_POKEMON_ROWS, STOCK_TRAINER_ROWS, STOCK_ENERGY_ROWS];
    let handedOut = 0;
    for (let i = 0; i < rows.length; i++) {
      const share = Math.floor((spare * weights[i]) / TOTAL_ROW_BUDGET);
      rows[i] += share;
      handedOut += share;
    }
    // Rounding leftovers go to the Trainer table, the one that most often
    // needs the room.
    rows[1] += spare - handedOut;
  }

  const pokemonTable = table(TABLE_TOP, rows[0]);
  const trainerTable = table(pokemonTable.bottom + GAP_AFTER_POKEMON, rows[1]);
  const energyTable = table(trainerTable.bottom + GAP_AFTER_TRAINER, rows[2]);
  return { pokemon: pokemonTable, trainer: trainerTable, energy: energyTable, redrawn: true };
}

// ── Content ─────────────────────────────────────────────────────────────────

function printableName(name: string): string {
  // The font has no curly apostrophe; PTCGL writes "Boss’s Orders" with one.
  let out = plainApostrophes(name);
  for (const [from, to] of NAME_SUBSTITUTIONS) out = out.split(from).join(to);
  // The card data tells some arts apart in the name — "Professor's Research
  // (Professor Sada)", "Boss's Orders (Ghetsis)" — but the card is just named
  // "Professor's Research", and that's what the list asks for.
  out = out.replace(/\s*\([^)]*\)\s*$/, '');
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Basic Energy is "Fire Energy" in older sets and "Basic Fire Energy" from
 * Scarlet & Violet on. Both are the same card, so they're written one way.
 * Only cards known to be Basic are touched: "Darkness Energy" was also a
 * Special Energy once.
 */
function energyName(name: string, subtypes: string[]): string {
  if (!subtypes.some((s) => s.toLowerCase() === 'basic')) return name;
  return `Basic ${name.replace(/^Basic\s+/i, '')}`;
}

/**
 * Splits a deck into the form's three tables, resolving the set code,
 * collector number and regulation mark each Pokémon row needs.
 *
 * Pokémon are listed per print — the SET and COLL. # columns tell two arts
 * apart. Trainers and Energy have no such columns, so different prints of the
 * same card share one row with their copies added up.
 */
export function splitDeck(cards: DeckCard[], db: CardDatabase): DeckListSections {
  const sections: DeckListSections = {
    pokemon: [],
    trainer: [],
    energy: [],
    unclassified: [],
    missingSetInfo: [],
    missingRegulationMark: [],
  };
  const rowsByName = new Map<DeckListEntry[], Map<string, DeckListEntry>>();
  const addByName = (table: DeckListEntry[], quantity: number, name: string) => {
    let rows = rowsByName.get(table);
    if (!rows) rowsByName.set(table, (rows = new Map()));
    const key = nameKey(name);
    const existing = rows.get(key);
    if (existing) {
      existing.quantity += quantity;
      return;
    }
    const entry = { quantity, name };
    rows.set(key, entry);
    table.push(entry);
  };

  for (const card of cards) {
    const print = card.cardId ? db.getById(card.cardId) : undefined;
    // A card saved without a supertype can still be classified from its print.
    const supertype = (card.supertype || print?.supertype || '').toLowerCase();
    const name = printableName(card.name);

    if (isPokemon(supertype)) {
      const setCode = card.cardId ? formSetCode(card.cardId, db) : undefined;
      const number = setCode && card.cardId ? db.collectorNumber(card.cardId) : undefined;
      const regulationMark = print?.regulationMark;
      if (!setCode) sections.missingSetInfo.push(card.name);
      if (!regulationMark && mayHaveRegulationMark(card.cardId, db)) sections.missingRegulationMark.push(card.name);
      sections.pokemon.push({ quantity: card.quantity, name, setCode, number, regulationMark });
    } else if (supertype === 'energy') {
      const subtypes = card.subtypes.length ? card.subtypes : (print?.subtypes ?? []);
      addByName(sections.energy, card.quantity, energyName(name, subtypes));
    } else {
      // Anything left goes in the Trainer table: it's by far the largest, and
      // an unrecognised card is much more often a Trainer than not. The player
      // is told which rows were guessed so they can correct the sheet.
      if (supertype !== 'trainer' && !sections.unclassified.includes(card.name)) {
        sections.unclassified.push(card.name);
      }
      addByName(sections.trainer, card.quantity, name);
    }
  }
  return sections;
}

/** False only for a print known to predate regulation marks. */
function mayHaveRegulationMark(cardId: string | undefined, db: CardDatabase): boolean {
  const released = cardId ? db.releaseDate(setIdOf(cardId) ?? '') : '';
  return released === '' || released >= FIRST_REGULATION_MARK_DATE;
}

/**
 * What the form's SET column says for a print.
 *
 * The form: "If one of the cards in your deck comes from a set previous to
 * those listed, but was reprinted in one of the listed sets, put NA as the set
 * name." That's decided by release date — a set the database doesn't know
 * could equally be brand new, and NA would be wrong for it.
 */
function formSetCode(cardId: string, db: CardDatabase): string | undefined {
  const setId = setIdOf(cardId) ?? '';
  // The form's own legend first: BW promos are dated a few weeks before Black
  // & White itself, but the form lists them.
  if (FORM_SET_CODES[setId]) return FORM_SET_CODES[setId];
  if (/^mcd\d+$/.test(setId)) return 'MCD'; // McDonald's Collection
  const released = db.releaseDate(setId);
  if (released !== '' && released < OLDEST_LISTED_SET_DATE) return NOT_APPLICABLE;
  return db.setCode(setId);
}

// ── Building ────────────────────────────────────────────────────────────────

export async function buildDeckListPdf(options: DeckListOptions): Promise<DeckListPdfResult> {
  const { player, assets } = options;
  const sections = splitDeck(options.cards, options.db);
  const layout = layoutFor({
    pokemon: sections.pokemon.length,
    trainer: sections.trainer.length,
    energy: sections.energy.length,
  });
  const pageCount = Math.max(
    1,
    Math.ceil(sections.pokemon.length / layout.pokemon.rows),
    Math.ceil(sections.trainer.length / layout.trainer.rows),
    Math.ceil(sections.energy.length / layout.energy.rows),
  );

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  // The bundled Roboto Condensed is already cut down to the characters card
  // names use, so it's embedded whole rather than subset again.
  const font = await doc.embedFont(assets.font, { subset: false });
  const boldFont = await doc.embedFont(assets.boldFont, { subset: false });
  const [form] = await doc.embedPdf(assets.form, [0]);

  // Titled after the player: this is a document being handed in, not a deck
  // being catalogued.
  doc.setTitle(`${player.name || options.deckName} — Play! Pokémon deck list`);
  if (player.name) doc.setAuthor(player.name);
  doc.setCreator('Deck Check');
  doc.setProducer('Deck Check');

  for (let page = 0; page < pageCount; page++) {
    const pdfPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pdfPage.drawPage(form, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });
    const painter = new Painter(pdfPage, font, boldFont);

    if (layout.redrawn) drawRedrawnTables(painter, layout);
    drawHeader(painter, player, options.format, options.division);
    if (pageCount > 1) {
      // Loose sheets get separated at check-in, and the form has no field for
      // this. English on purpose: it's read by a judge alongside the form.
      painter.textRightAligned(`Sheet ${page + 1} of ${pageCount}`, SHEET_LABEL_RIGHT, SHEET_LABEL_TOP, SHEET_LABEL_FONT_SIZE);
    }
    drawRows(painter, sections.pokemon, page, layout.pokemon, true);
    drawRows(painter, sections.trainer, page, layout.trainer, false);
    drawRows(painter, sections.energy, page, layout.energy, false);
  }

  return {
    bytes: await doc.save(),
    pageCount,
    unclassified: sections.unclassified,
    missingSetInfo: sections.missingSetInfo,
    missingRegulationMark: sections.missingRegulationMark,
  };
}

const two = (value: string) => value.padStart(2, '0');

function drawHeader(painter: Painter, player: Player, format: string, division?: AgeDivision) {
  const field = (range: readonly [number, number], text: string, align: Align = 'left') =>
    painter.fitted(text, range[0] + 1.5, range[1] - 1.5, HEADER_FIELD_TOP, HEADER_FIELD_HEIGHT, HEADER_FONT_SIZE, align);

  if (player.name) field(PLAYER_NAME, player.name);
  if (player.playerId) field(PLAYER_ID, player.playerId);
  if (player.dateOfBirth) {
    const [year, month, day] = player.dateOfBirth.split('-');
    field(DOB_MONTH, two(month ?? ''), 'center');
    field(DOB_DAY, two(day ?? ''), 'center');
    field(DOB_YEAR, year ?? '', 'center');
  }

  const f = format.toLowerCase();
  if (f === 'standard') painter.cross(STANDARD_BOX_LEFT, FORMAT_BOX_TOP, FORMAT_BOX_SIZE);
  if (f === 'expanded') painter.cross(EXPANDED_BOX_LEFT, FORMAT_BOX_TOP, FORMAT_BOX_SIZE);
  if (division) painter.cross(DIVISION_BOX_LEFT, DIVISION_BOX_TOPS[division], DIVISION_BOX_SIZE);
}

/** The slice of [entries] belonging to [page], laid onto the ruled rows. */
function drawRows(painter: Painter, entries: DeckListEntry[], page: number, section: TableLayout, withSetColumns: boolean) {
  const start = page * section.rows;
  const end = Math.min(start + section.rows, entries.length);
  const cell = (left: number, right: number, top: number, text: string, align: Align = 'left') =>
    painter.fitted(text, left + 2.5, right - 2.5, top, ROW_HEIGHT, ROW_FONT_SIZE, align);

  for (let i = start; i < end; i++) {
    const entry = entries[i];
    const top = section.firstRowTop + (i - start) * ROW_HEIGHT;
    cell(QTY_LEFT, QTY_RIGHT, top, String(entry.quantity), 'center');
    cell(NAME_LEFT, withSetColumns ? SET_LEFT : TABLE_RIGHT, top, entry.name);
    if (withSetColumns) {
      if (entry.setCode) cell(SET_LEFT, COLL_LEFT, top, entry.setCode, 'center');
      if (entry.number) cell(COLL_LEFT, REG_LEFT, top, entry.number, 'center');
      if (entry.regulationMark) cell(REG_LEFT, TABLE_RIGHT, top, entry.regulationMark, 'center');
    }
  }
}

/**
 * Paints re-proportioned tables over the printed ones, rebuilt from the same
 * measurements and colours so the sheet reads identically. Everything else on
 * the page — set legend, header, footnotes — is left as printed.
 */
function drawRedrawnTables(painter: Painter, layout: DeckListLayout) {
  // The mask stops at the bottom of the stock Energy table, which is as far
  // down as any layout reaches.
  painter.rect(QTY_LEFT, TABLE_TOP, TABLE_RIGHT - QTY_LEFT, STOCK_LAYOUT.energy.bottom - TABLE_TOP, WHITE);
  drawTable(painter, layout.pokemon, 'Pokémon', true);
  drawTable(painter, layout.trainer, 'Trainer', false);
  drawTable(painter, layout.energy, 'Energy', false);
}

function drawTable(painter: Painter, section: TableLayout, name: string, withSetColumns: boolean) {
  const width = TABLE_RIGHT - QTY_LEFT;
  const label = (left: number, text: string, color: Color, top = section.labelsTop) =>
    painter.boldText(text, left, top + LABEL_INSET, TABLE_LABEL_FONT_SIZE, color);

  painter.rect(QTY_LEFT, section.headerTop, width, ROW_HEIGHT, SECTION_BAND_COLOR);
  label(SECTION_NAME_LEFT, name, SECTION_TEXT_COLOR, section.headerTop);

  painter.rect(QTY_LEFT, section.labelsTop, width, ROW_HEIGHT, LABEL_BAND_COLOR);
  label(268.8, 'QTY:', WHITE);
  label(300.2, 'NAME:', WHITE);
  if (withSetColumns) {
    label(478.2, 'SET:', WHITE);
    label(508.0, 'COLL. #:', WHITE);
    label(551.0, 'REG:', WHITE);
  }

  const height = section.rows * ROW_HEIGHT;
  painter.rect(QTY_LEFT, section.firstRowTop, width, height, ROW_COLOR);
  for (let i = 1; i < section.rows; i++) {
    painter.rect(QTY_LEFT, section.firstRowTop + i * ROW_HEIGHT - RULE_WIDTH / 2, width, RULE_WIDTH, WHITE);
  }
  const dividers = withSetColumns ? [QTY_RIGHT, SET_LEFT, COLL_LEFT, REG_LEFT] : [QTY_RIGHT];
  for (const x of dividers) {
    painter.rect(x - RULE_WIDTH / 2, section.firstRowTop, RULE_WIDTH, height, WHITE);
  }
}

type Align = 'left' | 'center';

/** Draws onto a page using the form's top-left coordinates. */
class Painter {
  private readonly glyphs: Set<number>;

  constructor(
    private readonly page: PDFPage,
    private readonly font: PDFFont,
    private readonly bold: PDFFont,
  ) {
    this.glyphs = new Set(font.getCharacterSet());
  }

  /** Swaps out anything the font can't draw, so one odd character costs a glyph, not the export. */
  private printable(text: string): string {
    return Array.from(text, (ch) => (this.glyphs.has(ch.codePointAt(0)!) ? ch : '?')).join('');
  }

  private y(top: number): number {
    return PAGE_HEIGHT - top;
  }

  rect(left: number, top: number, width: number, height: number, color: Color) {
    this.page.drawRectangle({ x: left, y: this.y(top + height), width, height, color });
  }

  /**
   * Text in a box, centred vertically. Shrinks to fit the width rather than
   * wrapping or spilling into the next column, but never grows.
   */
  fitted(raw: string, left: number, right: number, top: number, height: number, size: number, align: Align) {
    const text = this.printable(raw);
    const width = right - left;
    const natural = this.font.widthOfTextAtSize(text, size);
    const fittedSize = natural > width ? (size * width) / natural : size;
    const textWidth = (natural * fittedSize) / size;
    const x = align === 'center' ? left + (width - textWidth) / 2 : left;
    const ascent = this.font.heightAtSize(fittedSize, { descender: false });
    const lineHeight = this.font.heightAtSize(fittedSize);
    const baseline = top + (height - lineHeight) / 2 + ascent;
    this.page.drawText(text, { x, y: this.y(baseline), size: fittedSize, font: this.font, color: BLACK });
  }

  /** Bold text whose line box starts at [top]. */
  boldText(text: string, left: number, top: number, size: number, color: Color) {
    const baseline = top + this.bold.heightAtSize(size, { descender: false });
    this.page.drawText(text, { x: left, y: this.y(baseline), size, font: this.bold, color });
  }

  textRightAligned(raw: string, right: number, top: number, size: number) {
    const text = this.printable(raw);
    const baseline = top + this.font.heightAtSize(size, { descender: false });
    const x = right - this.font.widthOfTextAtSize(text, size);
    this.page.drawText(text, { x, y: this.y(baseline), size, font: this.font, color: BLACK });
  }

  /** An X inside one of the form's checkboxes: two stroked lines, crisp at any zoom. */
  cross(left: number, top: number, size: number) {
    const inset = 1.5;
    const line = (x1: number, y1: number, x2: number, y2: number) =>
      this.page.drawLine({
        start: { x: x1, y: this.y(y1) },
        end: { x: x2, y: this.y(y2) },
        thickness: 0.9,
        color: BLACK,
        lineCap: LineCapStyle.Round,
      });
    line(left + inset, top + inset, left + size - inset, top + size - inset);
    line(left + inset, top + size - inset, left + size - inset, top + inset);
  }
}
