// F12-K43 L4: shared HTML escape — wcześniej 5 plików miało inline
// escape() helper'y robiące tylko 4 znaki (& < > "). html-escaper handle'uje
// edge cases (Unicode, surrogate pairs, ' i tym podobne) i jest popularną
// no-deps libką (~6KB).
//
// Używaj wszędzie gdzie wkleja się user input do HTML stringu (głównie
// email templates, link tytułów taska itp.). React renderuje string'i
// auto-escape, więc tego helper'a NIE potrzebujesz w JSX'ie.

export { escape as escapeHtml } from "html-escaper";
