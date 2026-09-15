# Deck Check

Build a Pokémon TCG deck in the browser and export it on the official Play! Pokémon tournament deck list.

```bash
npm install
npm run dev        # http://localhost:5173
npm test
npm run build      # static site in dist/
```

Everything runs in the browser, with no server and no accounts. Decks and player details are saved in localStorage.

## Card data

`public/data/cards.json` holds every card on [pokemontcg.io](https://pokemontcg.io), about 20,000, compacted to roughly 1.3 MB. The promos pokemontcg.io is missing come from [TCGdex](https://tcgdex.dev): all Mega Evolution promos (MEP) and Mega Evolution Energy (MEE), plus newer Scarlet & Violet and Sword & Shield promos. Their art comes from TCGdex, or from Scrydex (where pokemontcg.io keeps its newer images) when TCGdex has none. A card neither has shows a placeholder until a later update finds some.

Update it with:

```bash
npm run cards                    # add new sets and promos, refresh legality and set codes
npm run cards -- --check         # only list what's missing
npm run cards -- --sets=me5,me4  # re-download specific sets
npm run cards -- --full          # re-download everything (a few minutes)
```

When to run it:

- after each set release
- after each rotation, so Standard legality is current

Other notes:

- **Rate limits:** set `POKEMONTCG_API_KEY` to raise them.
- **Interrupted runs:** the API fails now and then. The script retries each request and saves after every set, so running it again finishes an interrupted update.
- **Set codes:** these come from the data too, so a new set shows up on the deck list with its code without any code changes.

## The deck list form

`public/form/play-pokemon-deck-list.pdf` is the official 2026 season form ("noncommercial reproduction permitted"). Every export embeds its page as-is and draws the deck over it, at coordinates measured from this PDF.

When a new season's form comes out:

1. Replace the PDF, keeping the file name.
2. Bump `FORM_SEASON` in `src/lib/division.ts`.
3. Re-check the coordinates at the top of `src/lib/deckListPdf.ts`. To write sample sheets you can look at, run `DECK_LIST_PDF_OUT=sheet.pdf npm test`. `DECK_LIST_RESIZED_OUT` and `DECK_LIST_OVERFLOW_OUT` write a resized sheet and a two-sheet list.
4. If the form's set legend changed, update `OLDEST_LISTED_SET_DATE` and `FORM_SET_CODES` in the same file.

`public/form/RobotoCondensed-*.ttf` is Roboto Condensed (© Google, Apache License 2.0), cut down to Latin, Greek and common punctuation.
