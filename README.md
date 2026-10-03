# Player Lookup

A web version of the Player Lookup LocalScript. It shows public Roblox profile data
and needs no executor or Roblox login.

## Start it
1. Install Node.js (LTS) from https://nodejs.org
2. Double-click `start.bat`. Your browser opens http://localhost:3100.
   Keep the black window open while you use it.

It uses port 3100, so it can run at the same time as Avatar Stand (port 3000).

## What it shows
Profile summary, online status, friend/follower/following counts, account age, badges,
groups and roles, past usernames, bio, full avatar, worn items, saved outfits (click to
expand), friends, followers, created and favorite games, limiteds with RAP (if the
inventory is public), and an Observations list.

Click **VIEW ALL →** on any section, or the ▤ button, to open the browser window with
tabs and a filter. Clicking a friend or follower looks them up.

Anything a user has hidden with Roblox privacy settings shows as hidden.

## Optional: add a login for complete results
Without a login, Roblox hides some lists from the app and often reports online players as
offline. Sections Roblox hides for that reason say "Roblox only shows this to logged-in
viewers," which is different from a player making something private.

**The `.ROBLOSECURITY` cookie is a full key to an account. Use an alt account, never your
main, and never share the file.** The app only sends it to roblox.com.

1. Log into Roblox in your browser with the alt account.
2. Press F12. Chrome/Edge: Application → Cookies → https://www.roblox.com.
   Firefox: Storage → Cookies → https://www.roblox.com.
3. Copy the **Value** of `.ROBLOSECURITY`.
4. Save it in a file named `roblox-cookie.txt` in this folder.
5. Close the black window and run `start.bat` again. It should say "Login found".

Even with a login, players who hide their online status will show as "Offline or hidden",
and the game name only appears when that player lets your alt see it.
