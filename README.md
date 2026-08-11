# reprolegal.com

Static site on a Cloudflare Worker with static assets. No build step, no framework.

## Layout
```
index.html            home
countries.html        destination matcher (data in content/destinations.json)
countries/*.html      10 destination pages
costs.html            cost explorer
how-it-works.html     five stages
programmes.html       programme types
faq.html              FAQPage schema
stories.html          reviews (consent required)
blog.html             journal index, cards injected at <!-- POSTS -->
blog/*.html           articles (generated)
assets/site.css       one stylesheet for every page
assets/site.js        header, drawer, scroll reveals, counters, view counter
assets/explorer.js    cost arc chart (index + costs only)
assets/matcher.js     country matcher (countries only)
img/                  webp images
_worker.js            /api/views on KV, everything else static
```

## Local
```
npx wrangler dev
```

## Deploy
```
npx wrangler kv namespace create VIEWS   # paste the id into wrangler.toml
npx wrangler deploy
```
Or push to `main` — see `.github/workflows/deploy.yml`.

## Secrets
| Where | Name | Why |
|---|---|---|
| GitHub | `ANTHROPIC_API_KEY` | article generation |
| GitHub | `CLOUDFLARE_API_TOKEN` | deploy |
| GitHub | `CLOUDFLARE_ACCOUNT_ID` | deploy |

## Still to fill in
- `YOUR_FORM_ID` (Formspree) and `YOUR_HANDLE` (Cal.com) in index.html
- GA4 / GTM id — and it must load **after** cookie consent
- phone numbers, registered address, real coordinator photo
- legal cells marked `[verify]` in content/destinations.json — confirmed by local counsel
- privacy.html and cookies.html are placeholders and must be drafted properly
- img/og.png (1200x630)
