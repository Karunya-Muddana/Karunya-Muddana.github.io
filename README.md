# Karunya Muddana — Portfolio

A handcrafted portfolio site for Karunya Muddana — first-year CS student at GITAM, Hyderabad.

Built as a paper-and-ink scrapbook: rough.js sketched borders, crumpled paper textures, polaroid hero photo, a stacked-card printable resume, and an interactive AI chat that writes back like the Tom Riddle diary.

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Main portfolio — hero, stats, projects, skills, writing, contact. |
| `about.html` | Personal essay with a paper-plane that descends as you scroll. |
| `resume.html` | Stacked-card resume — print to PDF for a clean traditional resume. |
| `chat.html` | Ruled-notebook AI chat. Ink-fade reveal on every reply. |

## Stack

- Vanilla HTML / CSS / JS — **no build step**.
- [rough.js](https://roughjs.com/) (CDN) for hand-drawn sketched borders on cards, pills, and buttons.
- Google Fonts: Fraunces (display), DM Sans (body), JetBrains Mono (mono), Caveat (handwriting).
- AI chat hits a FastAPI agent endpoint — see `chat.js` for the contract.

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

If Formspree is unset or fails for any reason, the form gracefully falls back to `mailto:`, so the contact path is never broken.

## Customising

- **Photo**: replace `assets/karunya.png` (PNG with transparent background works best — used in the polaroid).
- **Plane illustration**: `assets/plane.png` — a hand-drawn pencil sketch, used as the paper plane on the about page.
- **Resume content**: edit `resume.html` directly. The print stylesheet in `styles.css` converts the stacked cards into a clean single-column resume when the user hits Print.
- **AI chat endpoint**: change `API_BASE` at the top of `chat.js`.

## Credits

- Hand-drawn pencil paper plane: original sketch.
- Doodles (used sparingly as decoration): [dddoodle pack](https://fffuel.co/) by Seb, CC-BY.
- Open Peeps illustration on the about page: by [Pablo Stanley](https://www.openpeeps.com/), CC0.

## License

MIT. Personal portfolio — feel free to fork the structure, but please don't reuse the photos, illustrations, or copy verbatim.
