# Karunya Muddana — Portfolio

A handcrafted portfolio site for Karunya Muddana — second-year CS (AI & ML) student at GITAM, Hyderabad, and AI engineer.

Built as a paper-and-ink scrapbook crossed with a code editor: rough.js sketched borders, crumpled paper textures, polaroid hero photo, a stacked-card printable resume, and an interactive AI chat that writes back like the Tom Riddle diary.

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Main portfolio — hero, stats, experience (git log), projects, open source (PR cards), stack, writing, contact. |
| `about.html` | Personal essay with a paper-plane that descends as you scroll. |
| `resume.html` | Stacked-card resume — print to PDF for a clean traditional resume. |
| `chat.html` | Ruled-notebook AI chat. Ink-fade reveal on every reply. |

## Stack

- Vanilla HTML / CSS / JS — **no build step**. Every library is vendored in `vendor/` and served from the same origin (no CDN round-trips); only three.js (for the footer meadow) is lazy-loaded from jsDelivr when the grass scrolls near.
- [rough.js](https://roughjs.com/) for the hand-drawn borders, the git-graph pencil line, the scribbled diffs and the sketched bar chart.
- [GSAP](https://gsap.com/) + SplitText for the hero headline write-in; [Lenis](https://lenis.darkroom.engineering/) for inertial scroll on mice.
- [anime.js v4](https://animejs.com/) (`code-motion.js`) for two things only: the pencil git graph in Experience, drawn once when it comes into view, and the sticky notes you can peel off the project cards.
- Three font families, self-hosted in `fonts/` (latin subsets, all SIL OFL): Fraunces (display), DM Sans (body), Victor Mono (code). Victor Mono's italic is cursive, so it is also the handwriting on sticky notes and annotations.
- AI chat hits a Cloudflare Worker — see `worker/README.md`.

Motion is deliberately small: the hero headline writes itself in once, the git graph draws once, and everything else is just there. No scroll reveals, parallax or custom cursor. Everything respects `prefers-reduced-motion`.

The design was checked against [Hallmark](https://github.com/nutlope/hallmark)'s anti-slop rules; the stamp at the top of `styles.css` and `.hallmark/log.json` record that pass.

### Vendored libraries

| File | Source |
| --- | --- |
| `vendor/anime.min.js` | animejs@4.5.0, tree-shaken to the parts the site uses (≈20 KB gzipped instead of 41 KB) |
| `vendor/gsap.min.js`, `vendor/SplitText.min.js` | gsap@3.15.0 `dist/` |
| `vendor/lenis.min.js` | lenis@1.3.26 `dist/` |
| `vendor/rough.min.js` | roughjs@4.6.6 `bundled/rough.js`, minified |
| `assets/icons/*.svg` | devicon@2.17.0 |

To rebuild the anime.js subset (e.g. to use another export), in an empty folder:

```bash
npm i animejs@4.5.0 esbuild
cat > entry.js <<'JS'
export { animate } from 'animejs/animation';
export { createDraggable } from 'animejs/draggable';
export { createDrawable } from 'animejs/svg';
export { spring } from 'animejs/easings/spring';
JS
npx esbuild entry.js --bundle --format=esm --minify --target=es2019 --legal-comments=none --outfile=anime.min.js
```

## Local development

Open `index.html` directly in a browser, or serve the directory with any static server:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deploying to GitHub Pages

1. Push this repository to GitHub.
2. In the repo **Settings → Pages**, set the **Source** to your default branch (`main`) and folder `/ (root)`.
3. Save. The site will be live at `https://<your-username>.github.io/<repo-name>/`.

The `.nojekyll` file in the project root tells GitHub Pages to skip Jekyll processing and serve the files exactly as-is — required because some assets live under `assets/` with leading underscores or other patterns Jekyll would otherwise ignore.

All paths in the project are relative, so the site will work whether it's served from the root of a domain or from a `/repo-name/` subpath.

## Contact form

The form on the main page works **out of the box** via `mailto:` — it opens the visitor's mail client with the fields pre-filled, and the visitor sends from their own email.

For real serverless email delivery (no mail client required, messages land directly in your inbox):

1. Sign up at [Formspree](https://formspree.io/) — free tier covers ~50 submissions/month.
2. Create a new form. Copy the endpoint URL (looks like `https://formspree.io/f/xxxxxxxx`).
3. Open `portfolio.js`, find `FORMSPREE_ENDPOINT`, and paste the endpoint there.
4. Optionally update `CONTACT_EMAIL` on the next line if you change addresses.

If Formspree is unset or fails for any reason, the form falls back to `mailto:`, so the contact path is never broken.

## Customising

- **Photo**: replace `assets/karunya.png` (PNG with transparent background works best — used in the polaroid).
- **Plane illustration**: `assets/plane.png` — a hand-drawn pencil sketch, used as the paper plane on the about page.
- **Resume content**: edit `resume.html` directly. The print stylesheet in `styles.css` converts the stacked cards into a clean single-column resume when the user hits Print.
- **AI chat endpoint**: change `API_BASE` at the top of `chat.js`.

## Credits

- Hand-drawn pencil paper plane: original sketch.
- Language icons: [devicon](https://devicon.dev/), MIT.
- Fonts: Fraunces, DM Sans, Victor Mono — SIL Open Font License.
- Doodles (used sparingly as decoration): [dddoodle pack](https://fffuel.co/) by Seb, CC-BY.
- Open Peeps illustration on the about page: by [Pablo Stanley](https://www.openpeeps.com/), CC0.

## License

MIT. Personal portfolio — feel free to fork the structure, but please don't reuse the photos, illustrations, or copy verbatim.
