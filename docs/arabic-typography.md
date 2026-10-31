# Arabic typography

The `[locale]` layout sets `lang` and `dir` from the route. Arabic routes load Tajawal through `next/font/local` from `frontend/src/fonts/`; English routes continue using Arial/Helvetica. The font files and `OFL.txt` came from the [Google Fonts Tajawal directory](https://github.com/google/fonts/tree/main/ofl/tajawal) under the SIL Open Font License 1.1. Four supplied weights are used: 400, 500, 700, and 800. CSS selects the font centrally for Arabic body text, form controls, dialogs, and SVG chart text; it removes letter spacing utilities on Arabic pages to keep Arabic script readable. Portals mounted under `body` inherit the same font.

The font is bundled at build time; production rendering does not download from Google Fonts. Restaurant-supplied names and other user content stay unchanged. The English font and established Savora layout, palette, and components remain intact.

## Verification (2026-10-20)

The Next.js 16 Webpack production build succeeded offline using the local font files. Chrome checked computed font family and `dir` for English desktop/mobile and Arabic mobile; Arabic checks covered landing, About, menu/product, cart, Checkout input, Owner Orders dialog, Overview chart labels, and action buttons. Settings, Categories, and Products were also opened with mocked owner APIs on desktop English, desktop Arabic, and mobile Arabic. Their computed body font and page overflow were checked; Settings inputs were checked separately. Screenshots were captured, including the mobile Arabic owner pages. The dashboard's existing English copy remains English on Arabic routes; this typography task does not translate it.
