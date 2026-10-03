# Player Lookup

Look up any Roblox player's public profile: avatar, friends, communities,
badges, games, limiteds and more. Only data Roblox makes public is shown, and
private settings are respected.

There are two ways to run it.

## A. Public website (Netlify) — shows public data
Deploy the whole folder to Netlify. Anyone can use it, no install, no login.
See DEPLOY.md for the steps. The public site cannot use a Roblox login, because
browsers block websites from sending your Roblox login to roblox.com. That's a
safety feature, not a limitation to work around.

## B. Local app — adds a login for complete data
Run it on your own computer to get accurate online status and the lists Roblox
only shows to signed-in viewers.

1. Install Node.js (LTS) from https://nodejs.org
2. Double-click `start.bat`. It opens http://localhost:3100. Keep the window open.
3. Click **Log in** and follow the steps to paste your login.

You can also use the public website *with* your local app: open the Netlify site,
click Log in, and it will send your login only to the local server on your own
machine (localhost), never to the website.

## About the login
A login is optional. Without it you still see everything public. With it you also
get real online status and signed-in-only lists.

The login is your `.ROBLOSECURITY` cookie. **It is a full key to your account,
like a password.** Use an alt account if you can, never share it, and only paste
it into this app. The app stores it only where you choose:
- **Until I close this tab** (default, safest)
- **Remember on this device** (stays after reload, in your browser only)
- **Don't save** (used once)

Nothing is ever sent to the public website. The local app sends it only to
roblox.com. See `userscript.js` for an optional helper that guides you through
copying the cookie; it makes no network calls and you're encouraged to read it or
have an AI check it first.

## Files
- `index.html` — the app
- `server.js` — the local server
- `roblox-core.js` — shared Roblox data layer (used by both server and Netlify)
- `netlify/functions/api.js` — the public serverless function
- `netlify.toml`, `public/` — Netlify deploy config and static root
- `userscript.js` — optional cookie-copy helper
- `start.bat` — local launcher (Windows)
