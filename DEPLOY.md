# Deploying Player Lookup to Netlify

The public site serves only public Roblox data through a serverless function.
No login is involved, so there's nothing sensitive to host.

## Option 1: Drag and drop (fastest)
Netlify's drag-and-drop only handles static files, not functions, so use the
Git or CLI method below for the full app. Drag-and-drop will host the page but
lookups won't work.

## Option 2: Netlify CLI
1. Install the CLI and sign in:
   ```
   npm install -g netlify-cli
   netlify login
   ```
2. From this folder, deploy:
   ```
   netlify deploy --build --prod
   ```
   When asked, accept the publish directory `public` and functions directory
   `netlify/functions` (already set in `netlify.toml`).

## Option 3: Connect a Git repo
1. Push this folder to a GitHub/GitLab repo.
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
3. Netlify reads `netlify.toml` automatically:
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
4. Deploy.

## How it's wired
- `netlify.toml` sends `/api/*` to the single function in
  `netlify/functions/api.js`, which calls the shared `roblox-core.js`.
- `included_files = ["roblox-core.js"]` makes sure the shared module is bundled
  with the function.
- `public/index.html` is the page. It detects it's not on localhost and calls
  the `/api` function for public data. If a visitor adds a login, the page talks
  to *their own* local server instead, so their cookie never reaches your site.

## Keeping the public API polite
Roblox rate-limits by IP. On Netlify every request comes from Netlify's IPs, so
heavy public traffic can hit 429s. The function already queues, backs off and
caches. If your site gets popular and sees frequent 429s, consider adding your
own caching layer or asking users to run the local app.

## A note on the logo
`index.html` embeds Roblox's logo. That's fine for personal use, but Roblox's
brand guidelines don't allow third-party sites to use their logo. Before making
a site public under your own name, swap it for your own mark.
