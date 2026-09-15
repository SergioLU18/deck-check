/**
 * What a saved deck list is called: after the player, not the deck, since the
 * person collecting a folder of these needs to tell whose is whose. Only what
 * a filesystem objects to is stripped, so accented names survive.
 *
 * Kept apart from deckListPdf.ts so the page can name the file without
 * loading pdf-lib.
 */
export function deckListFileName(playerName: string, deckName: string): string {
  const base = (playerName.trim() || deckName.trim() || 'deck')
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return `${base}-deck-list.pdf`;
}
