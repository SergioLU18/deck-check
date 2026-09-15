import type { AgeDivision } from './types';

/**
 * The tournament season the bundled form is printed for. Drives the age
 * division checkbox; bump it whenever public/form is replaced.
 */
export const FORM_SEASON = 2026;

/**
 * The age division a player's date of birth puts them in for [season].
 *
 * Play! Pokémon divisions go by birth year relative to the season, not current
 * age: for 2026 Juniors are born 2014 or later, Seniors 2010–2013, Masters 2009
 * or earlier. Each new season shifts those years by one.
 */
export function divisionFor(dateOfBirth: string | undefined, season: number): AgeDivision | undefined {
  const year = Number(dateOfBirth?.slice(0, 4));
  if (!year) return undefined;
  if (year >= season - 12) return 'junior';
  if (year >= season - 16) return 'senior';
  return 'masters';
}

export const DIVISION_LABELS: Record<AgeDivision, string> = {
  junior: 'Junior',
  senior: 'Senior',
  masters: 'Masters',
};
