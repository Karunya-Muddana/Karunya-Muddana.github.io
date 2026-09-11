# karunya-chat

The backend for `chat.html`: a Cloudflare Worker that answers with Groq's free API.

Its knowledge is the site. On a cold start it fetches `index.html`, `about.html` and
`resume.html` from the live site, strips them to text (`src/extract.js`) and keeps that
for an hour. Edit a page, push, and within the hour the chat knows about it. No redeploy.

Models are a chain (`MODELS` in `wrangler.toml`). If one is rate-limited or retired, the
next one answers.

## First deploy

You need a free Cloudflare account and a Groq key from https://console.groq.com/keys.

```sh
cd worker
npm install
npx wrangler login                     # opens the browser once
npx wrangler deploy                    # prints the Worker's URL
npx wrangler secret put GROQ_API_KEY   # paste the key when it asks; it's stored encrypted
```

`deploy` prints the address, something like `https://karunya-chat.<your-subdomain>.workers.dev`.
Put that in `chat.js`:

```js
const API_BASE = 'https://karunya-chat.<your-subdomain>.workers.dev';
```

Then push the site as usual.

Check it's alive: open `https://karunya-chat.<your-subdomain>.workers.dev/health`. It
should show `ok: true` and a `contextChars` of roughly 14000.

## Everyday

| Want to | Do |
| --- | --- |
| Change the key | `npx wrangler secret put GROQ_API_KEY` again |
| See live logs | `npx wrangler tail` |
| Change models or pages | edit `[vars]` in `wrangler.toml`, then `npx wrangler deploy` |
| See what the model is told | `npm run context` |
| Run the tests (no key, no network) | `npm test` |
| Try it locally | put `GROQ_API_KEY=...` in `worker/.dev.vars`, then `npm run dev` |

Never commit the key. `.dev.vars` is git-ignored.

## Limits

- Each visitor: 6 messages a minute (`[[ratelimits]]` in `wrangler.toml`).
- Only `ALLOWED_ORIGINS` can call it from a browser. Add your custom domain there if you get one.
- The whole site is about 3,600 tokens, so one message costs ~4,500 with the prompt and
  history. On an 8K tokens-per-minute free model that's one or two messages a minute per
  model before it falls through to the next. If the chat gets popular and every model
  starts returning 429, the next step is sending only the relevant sections instead of
  the whole site.
