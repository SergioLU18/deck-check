import type { CardGroup } from './deck';
import type { AgeDivision, Format } from './types';

// Every label the app shows, in each language it speaks. Card names, set codes
// and the deck list PDF stay in English: the card data is English-only, and
// the official form is printed in English.

export type Language = 'en' | 'es';

export const LANGUAGES: { code: Language; label: string; name: string }[] = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'es', label: 'ES', name: 'Español' },
];

/** The saved choice if there is one, else the first of the browser's languages we speak. */
export function detectLanguage(saved: string | null, preferred: readonly string[] = []): Language {
  if (saved === 'en' || saved === 'es') return saved;
  const first = preferred.find((tag) => /^(en|es)\b/i.test(tag));
  return first?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const en = {
  language: 'Language',

  // App shell
  newDeckName: 'New deck',
  numberedDeck: (n: number) => `Deck ${n}`,
  untitledDeck: 'Untitled deck',
  currentDeck: 'Current deck',
  newDeckButton: 'New',
  deleteDeck: 'Delete deck',
  confirmDelete: (name: string) => `Delete “${name}”? This can't be undone.`,
  view: 'View',
  build: 'Build',
  deckListPdf: 'Deck list PDF',
  dbError: (message: string) => `Couldn't load the card database: ${message}`,
  tryAgain: 'Try again',
  loadingDb: 'Loading the card database…',
  footerData: (cards: number, updatedAt: string) => `${cards.toLocaleString('en-US')} cards, data as of ${updatedAt}. `,
  footerNote: (season: number) =>
    `Exports onto the official ${season} season deck list. Decks and player details stay in this browser.`,
  close: 'Close',

  // Shared
  formats: { Standard: 'Standard', Expanded: 'Expanded', Unlimited: 'Unlimited' } as Record<Format, string>,
  groups: {
    'Pokémon': 'Pokémon',
    Supporter: 'Supporter',
    Item: 'Item',
    Tool: 'Tool',
    Stadium: 'Stadium',
    Energy: 'Energy',
    Other: 'Other',
  } as Record<CardGroup, string>,
  supertypes: { 'Pokémon': 'Pokémon', Trainer: 'Trainer', Energy: 'Energy' } as Record<string, string>,
  divisions: { junior: 'Junior', senior: 'Senior', masters: 'Masters' } as Record<AgeDivision, string>,
  notLegalIn: (format: string) => `Not ${format}`,
  addToDeck: 'Add to deck',
  choosePrints: 'Choose prints',

  // Deck editor
  deckName: 'Deck name',
  format: 'Format',
  cardsOfTotal: (total: number, size: number) => `${total} of ${size} cards`,
  import: 'Import',
  copyList: 'Copy list',
  overBy: (size: number, extra: number) => `A deck has exactly ${size} cards — this one has ${extra} too many.`,
  importNotice: (lines: number, unmatched: number) =>
    `Imported ${lines} ${plural(lines, 'line', 'lines')}.` +
    (unmatched === 0
      ? ''
      : unmatched === 1
        ? " One card couldn't be matched to a print, so it was added by name — choose prints before exporting."
        : ` ${unmatched} cards couldn't be matched to a print, so they were added by name — choose prints before exporting.`),
  copied: 'Copied the list in Pokémon TCG Live format.',
  copyFailed: "Couldn't copy to the clipboard.",
  emptyDeck: 'No cards yet. Search for cards to add, or import a list from Pokémon TCG Live.',
  addCards: 'Add cards',
  changePrint: 'Change print',
  changePrintOf: (name: string) => `Change print of ${name}`,
  changePrintTitle: (name: string) => `Change print — ${name}`,
  noPrintChosen: 'No print chosen',
  remove: (name: string) => `Remove ${name}`,
  oneFewerOf: (name: string) => `One fewer ${name}`,
  oneMoreOf: (name: string) => `One more ${name}`,

  // Card search
  added: (quantity: number, name: string) => `Added ${quantity}× ${name}`,
  backToPrints: 'Back to prints',
  back: 'Back',
  regulation: (mark: string) => `Reg. ${mark}`,
  quantity: 'Quantity',
  oneFewer: 'One fewer',
  oneMore: 'One more',
  printCount: (n: number) => `${n} ${plural(n, 'print', 'prints')}`,
  noPrints: 'No prints of this card in the database.',
  searchPlaceholder: 'Search cards by name',
  searchHint: 'Type a card name — “Charizard ex”, “Iono”, “Basic Fire Energy”.',
  noResults: 'No cards found.',

  // Import
  importTitle: 'Import a deck list',
  importSummary: (lines: number, cards: number) =>
    `${lines} ${plural(lines, 'line', 'lines')} · ${cards} ${plural(cards, 'card', 'cards')}`,
  nothingRecognised: 'Nothing recognised yet',
  replaceCards: 'Replace cards',
  importHelp:
    "Paste a list exported from Pokémon TCG Live (or Limitless). Each line is matched to a print by its set code and number; anything that can't be matched is kept by name so you can choose its print later.",
  listText: 'Deck list text',

  // Choosing prints
  choosePrintTitle: (name: string) => `Choose a print — ${name}`,
  cancel: 'Cancel',
  apply: 'Apply',
  allHavePrints: 'Every card in this deck already has a print.',
  resolveHelp:
    "These cards were added by name only, so the deck list can't fill in their set, collector number or regulation mark. Suggested prints are the newest legal ones — check they match the cards you're playing.",
  notInDatabase: 'No card with this name in the database',
  change: 'Change',
  applyPrintFor: (name: string) => `Apply print for ${name}`,

  // Deck list export
  deckListDetails: 'Deck list details',
  player: 'Player',
  playerName: 'Player name',
  playerId: 'Player ID',
  dateOfBirth: 'Date of birth',
  ageDivision: (season: number) => `Age division (${season} season)`,
  notSet: 'Not set',
  savedHint: 'Saved in this browser and reused for every deck.',
  leaveBlank: 'Leave blank',
  checkBeforeHandingIn: 'Check before handing in',
  downloadPdf: 'Download PDF',
  openToPrint: 'Open to print',
  preview: 'Preview',
  previewTitle: 'Deck list preview',
  buildError: (message: string) => `Couldn't build the deck list: ${message}`,
  building: 'Building the deck list…',
  updating: 'Updating…',
  choseprints: (n: number) => `Chose prints for ${n} ${plural(n, 'card', 'cards')}.`,
  wrongSize: (total: number, size: number) => `This deck has ${total} cards — a tournament deck has exactly ${size}.`,
  // "Sheet 1 of 2" is quoted as the form prints it, in English.
  multipleSheets: (pages: number) =>
    `The list runs onto ${pages} sheets, each labelled “Sheet 1 of ${pages}” and so on. Hand them in together.`,
  missingSetInfo: (names: string) => `No set or collector number for ${names}. Choose a print, or write them in by hand.`,
  missingRegulationMark: (names: string) => `No regulation mark for ${names}.`,
  unclassified: (names: string, count: number) =>
    count === 1
      ? `Couldn't tell what kind of card ${names} is, so it's listed under Trainer.`
      : `Couldn't tell what kind of cards ${names} are, so they're listed under Trainer.`,
  illegalCards: (format: string, names: string) => `Not legal in ${format}: ${names}.`,
};

export type Strings = typeof en;

// Neutral Latin American Spanish, with the card game's official Spanish terms
// (baraja, Partidario, Objeto, Estadio…) and Play! Pokémon's division names.
const es: Strings = {
  language: 'Idioma',

  newDeckName: 'Baraja nueva',
  numberedDeck: (n) => `Baraja ${n}`,
  untitledDeck: 'Baraja sin nombre',
  currentDeck: 'Baraja actual',
  newDeckButton: 'Nueva',
  deleteDeck: 'Eliminar baraja',
  confirmDelete: (name) => `¿Eliminar “${name}”? No se puede deshacer.`,
  view: 'Vista',
  build: 'Construir',
  deckListPdf: 'Lista en PDF',
  dbError: (message) => `No se pudo cargar la base de datos de cartas: ${message}`,
  tryAgain: 'Reintentar',
  loadingDb: 'Cargando la base de datos de cartas…',
  footerData: (cards, updatedAt) => `${cards.toLocaleString('es-MX')} cartas, datos al ${updatedAt}. `,
  footerNote: (season) =>
    `Exporta a la lista de baraja oficial de la temporada ${season}. Las barajas y los datos del jugador se guardan solo en este navegador.`,
  close: 'Cerrar',

  formats: { Standard: 'Estándar', Expanded: 'Expandido', Unlimited: 'Ilimitado' },
  groups: {
    'Pokémon': 'Pokémon',
    Supporter: 'Partidario',
    Item: 'Objeto',
    Tool: 'Herramienta',
    Stadium: 'Estadio',
    Energy: 'Energía',
    Other: 'Otras',
  },
  supertypes: { 'Pokémon': 'Pokémon', Trainer: 'Entrenador', Energy: 'Energía' },
  divisions: { junior: 'Júnior', senior: 'Sénior', masters: 'Máster' },
  notLegalIn: (format) => `No válida en ${format}`,
  addToDeck: 'Agregar a la baraja',
  choosePrints: 'Elegir versiones',

  deckName: 'Nombre de la baraja',
  format: 'Formato',
  cardsOfTotal: (total, size) => `${total} de ${size} cartas`,
  import: 'Importar',
  copyList: 'Copiar lista',
  overBy: (size, extra) => `Una baraja tiene exactamente ${size} cartas; a esta le ${plural(extra, 'sobra', 'sobran')} ${extra}.`,
  importNotice: (lines, unmatched) =>
    `Se ${plural(lines, 'importó', 'importaron')} ${lines} ${plural(lines, 'línea', 'líneas')}.` +
    (unmatched === 0
      ? ''
      : unmatched === 1
        ? ' Una carta no se pudo asociar a ninguna versión, así que se agregó por nombre; elige su versión antes de exportar.'
        : ` ${unmatched} cartas no se pudieron asociar a ninguna versión, así que se agregaron por nombre; elige sus versiones antes de exportar.`),
  copied: 'Lista copiada en formato de Pokémon TCG Live.',
  copyFailed: 'No se pudo copiar al portapapeles.',
  emptyDeck: 'Aún no hay cartas. Busca cartas para agregarlas o importa una lista de Pokémon TCG Live.',
  addCards: 'Agregar cartas',
  changePrint: 'Cambiar versión',
  changePrintOf: (name) => `Cambiar versión de ${name}`,
  changePrintTitle: (name) => `Cambiar versión — ${name}`,
  noPrintChosen: 'Sin versión elegida',
  remove: (name) => `Quitar ${name}`,
  oneFewerOf: (name) => `Una ${name} menos`,
  oneMoreOf: (name) => `Una ${name} más`,

  added: (quantity, name) => `Agregaste ${quantity}× ${name}`,
  backToPrints: 'Volver a las versiones',
  back: 'Volver',
  regulation: (mark) => `Reg. ${mark}`,
  quantity: 'Cantidad',
  oneFewer: 'Una menos',
  oneMore: 'Una más',
  printCount: (n) => `${n} ${plural(n, 'versión', 'versiones')}`,
  noPrints: 'No hay versiones de esta carta en la base de datos.',
  searchPlaceholder: 'Buscar cartas por nombre',
  // The card data is English-only, so say so where names are typed.
  searchHint: 'Escribe el nombre en inglés: “Charizard ex”, “Iono”, “Basic Fire Energy”.',
  noResults: 'No se encontraron cartas.',

  importTitle: 'Importar una lista',
  importSummary: (lines, cards) =>
    `${lines} ${plural(lines, 'línea', 'líneas')} · ${cards} ${plural(cards, 'carta', 'cartas')}`,
  nothingRecognised: 'Aún no se reconoce nada',
  replaceCards: 'Reemplazar cartas',
  importHelp:
    'Pega una lista exportada de Pokémon TCG Live (o Limitless). Cada línea se asocia a una versión por su código de expansión y número; lo que no se pueda asociar se conserva por nombre para que elijas su versión después.',
  listText: 'Texto de la lista',

  choosePrintTitle: (name) => `Elegir versión — ${name}`,
  cancel: 'Cancelar',
  apply: 'Aplicar',
  allHavePrints: 'Todas las cartas de esta baraja ya tienen versión.',
  resolveHelp:
    'Estas cartas se agregaron solo por nombre, así que la lista no puede llenar su expansión, número de colección ni marca de regulación. Las versiones sugeridas son las más recientes que son legales; revisa que coincidan con las cartas que vas a jugar.',
  notInDatabase: 'No hay ninguna carta con este nombre en la base de datos',
  change: 'Cambiar',
  applyPrintFor: (name) => `Aplicar versión para ${name}`,

  deckListDetails: 'Datos de la lista',
  player: 'Jugador',
  playerName: 'Nombre del jugador',
  playerId: 'ID de jugador',
  dateOfBirth: 'Fecha de nacimiento',
  ageDivision: (season) => `Categoría de edad (temporada ${season})`,
  notSet: 'Sin definir',
  savedHint: 'Se guarda en este navegador y se usa en todas tus barajas.',
  leaveBlank: 'En blanco',
  checkBeforeHandingIn: 'Revisa antes de entregar',
  downloadPdf: 'Descargar PDF',
  openToPrint: 'Abrir para imprimir',
  preview: 'Vista previa',
  previewTitle: 'Vista previa de la lista',
  buildError: (message) => `No se pudo generar la lista: ${message}`,
  building: 'Generando la lista…',
  updating: 'Actualizando…',
  choseprints: (n) =>
    `Se ${plural(n, 'eligió versión', 'eligieron versiones')} para ${n} ${plural(n, 'carta', 'cartas')}.`,
  wrongSize: (total, size) => `Esta baraja tiene ${total} cartas; una baraja de torneo tiene exactamente ${size}.`,
  multipleSheets: (pages) =>
    `La lista ocupa ${pages} hojas, marcadas “Sheet 1 of ${pages}” y así sucesivamente. Entrégalas juntas.`,
  missingSetInfo: (names) =>
    `Falta la expansión o el número de colección de ${names}. Elige una versión o escríbelos a mano.`,
  missingRegulationMark: (names) => `Falta la marca de regulación de ${names}.`,
  unclassified: (names, count) =>
    count === 1
      ? `No se pudo determinar qué tipo de carta es ${names}, así que aparece en la sección Trainer.`
      : `No se pudo determinar qué tipo de cartas son ${names}, así que aparecen en la sección Trainer.`,
  illegalCards: (format, names) => `No legales en ${format}: ${names}.`,
};

export const STRINGS: Record<Language, Strings> = { en, es };
