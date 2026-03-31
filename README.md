# Macro Meal Builder

Static macro tracking tool for `Chipotle`, `CAVA`, and `Sweetgreen`.

## Recommended stack

This project is set up for a very lightweight free stack:

- `Cloudflare Pages` for static hosting
- `Cloudflare DNS` for domain management
- `Cloudflare SSL` for free HTTPS

That keeps the site fast, cheap, and simple because this app is currently just a client-side tool. There is no database, no authentication, and no backend required.

## Why this stack fits this project

- The site is only static files: [index.html](./index.html), [styles.css](./styles.css), [script.js](./script.js), and [data.js](./data.js)
- Cloudflare Pages can host that for free on a `*.pages.dev` URL
- If you add a custom domain later, Cloudflare can handle DNS and HTTPS there too
- The included [_headers](./_headers) file adds basic security headers when deployed on Cloudflare Pages

## Deploy on Cloudflare Pages

For this repo's Git-based Pages setup, use:

- `Production branch`: `main`
- `Build command`: `exit 0`
- `Build output directory`: `.`

### Option 1: Git-based deploys

This is the best long-term setup because every push redeploys the site automatically.

1. Create a GitHub repository.
2. Push this project to GitHub.
3. In Cloudflare, go to `Workers & Pages`.
4. Click `Create application`.
5. Choose `Pages`.
6. Choose `Import an existing Git repository`.
7. Select your repo.
8. Use these settings:

```text
Production branch: main
Build command: exit 0
Build output directory: .
Root directory: (leave blank)
```

9. Deploy.

After the first deploy, your site will be live on a `*.pages.dev` URL.

### Option 2: Direct Upload

This is fastest if you do not want Git integration yet.

1. In Cloudflare, go to `Workers & Pages`.
2. Click `Create application`.
3. Choose `Pages`.
4. Choose `Direct Upload` or `Drag and drop your files`.
5. Upload this folder.
6. Deploy.

Cloudflare's docs note that Direct Upload projects cannot later be switched to Git integration, so create a new Pages project later if you want automatic Git-based deploys.

## Add a custom domain later

Once the site is live:

1. Buy a domain from any registrar you want.
2. Move the domain's nameservers to Cloudflare or connect the DNS records manually.
3. In your Pages project, add the custom domain.
4. Cloudflare will provision HTTPS automatically.

Common low-cost registrars include Porkbun and Namecheap. The domain has a yearly cost, but hosting this static site can still remain free.

## Current architecture

- Frontend: static HTML, CSS, and vanilla JavaScript
- Data: nutrition data stored directly in [data.js](./data.js)
- Persistence: browser `localStorage`
- Backend: none
- Auth: none
- Database: none

## If the app grows later

If you eventually want saved meals or accounts, add:

- `Supabase` for auth + Postgres
- `Cloudflare Turnstile` for anti-bot protection on forms

For now, none of that is necessary.

## Useful Cloudflare docs

- Direct Upload: <https://developers.cloudflare.com/pages/get-started/direct-upload/>
- Static HTML guide: <https://developers.cloudflare.com/pages/framework-guides/deploy-anything/>
- Custom headers: <https://developers.cloudflare.com/pages/configuration/headers/>
- Custom domains: <https://developers.cloudflare.com/pages/configuration/custom-domains/>
