// Polska pluralizacja — trzy formy (mianownik liczby pojedynczej,
// mianownik liczby mnogiej 2–4, dopełniacz liczby mnogiej 5+).
// Reguły: https://www.unicode.org/cldr/cldr-aux/charts/38/supplemental/language_plural_rules.html#pl
//
//   1 → "one":  "1 zadanie"
//   2-4 (oprócz 12-14) → "few":  "2 zadania", "23 zadania"
//   0 i 5+ → "many":  "0 zadań", "5 zadań", "12 zadań"
export function plPlural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export const taskPl = (n: number) => plPlural(n, "zadanie", "zadania", "zadań");
export const workspacePl = (n: number) =>
  plPlural(n, "przestrzeń roboczą", "przestrzenie robocze", "przestrzeni roboczych");
export const boardPl = (n: number) => plPlural(n, "tablica", "tablice", "tablic");
export const unreadPl = (n: number) => plPlural(n, "nowe", "nowe", "nowych");
export const commentPl = (n: number) => plPlural(n, "komentarz", "komentarze", "komentarzy");
export const attachmentPl = (n: number) =>
  plPlural(n, "załącznik", "załączniki", "załączników");
export const subtaskPl = (n: number) => plPlural(n, "podzadanie", "podzadania", "podzadań");
