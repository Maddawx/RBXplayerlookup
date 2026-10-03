// ===================================================================
//  Player Lookup — cookie helper  (OPTIONAL, read before using)
//
//  WHY THIS IS NEEDED
//  Your Roblox login (the .ROBLOSECURITY cookie) is marked "HttpOnly",
//  which means normal page code CANNOT read it. That's a good security
//  rule and this script does not try to defeat it. Instead it sends you
//  to Roblox's own "log out of all sessions" page, which deliberately
//  SHOWS you the cookie value on screen so you can copy it. That page is
//  on roblox.com, so only you see it.
//
//  WHAT THIS SCRIPT ACTUALLY DOES
//  - Opens https://www.roblox.com/my/account#!/security in this tab.
//  - Shows you step-by-step instructions in an on-page box.
//  That's it. It makes NO network requests, sends NOTHING anywhere, and
//  cannot even see your cookie (HttpOnly blocks that). The copying is
//  done by you, by hand, which is why it's safe.
//
//  VERIFY IT YOURSELF
//  This file is short on purpose. Paste the whole thing into an AI
//  assistant and ask: "Does this send my Roblox cookie anywhere, or log
//  anything?" The honest answer is no. If you didn't get this from your
//  own copy of Player Lookup, don't run it.
//
//  Your cookie is a full key to your account — treat it like a password.
//  Only paste it into Player Lookup running on your own machine.
// ===================================================================
(() => {
  "use strict";
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;inset:auto 16px 16px auto;z-index:2147483647;max-width:360px;background:#1b2a35;color:#e6edf2;font:14px/1.5 system-ui,sans-serif;padding:18px 20px;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.5);border:1px solid #2c404e";
  box.innerHTML =
    '<b style="font-size:15px">Get your Roblox login</b>' +
    '<ol style="margin:10px 0 0;padding-left:18px">' +
    '<li>On this Roblox page, press <b>F12</b>.</li>' +
    '<li>Open <b>Application</b> (Chrome/Edge) or <b>Storage</b> (Firefox).</li>' +
    '<li>Expand <b>Cookies</b> → <b>https://www.roblox.com</b>.</li>' +
    '<li>Click <b>.ROBLOSECURITY</b> and copy its <b>Value</b>.</li>' +
    '<li>Paste it into Player Lookup\u2019s login box.</li>' +
    '</ol>' +
    '<p style="margin:10px 0 0;color:#94a5b3">This value is like your password. Only paste it into Player Lookup on your own computer.</p>' +
    '<button id="pl-x" style="margin-top:12px;background:#0d69ac;color:#fff;border:0;border-radius:8px;padding:8px 14px;font:inherit;font-weight:700;cursor:pointer">Got it</button>';
  if (!location.hostname.endsWith("roblox.com")) {
    box.querySelector("ol").outerHTML = '<p style="margin:10px 0 0;color:#f5cd30">Open <b>https://www.roblox.com</b> and log in first, then run this again on that tab.</p>';
  }
  document.body.appendChild(box);
  box.querySelector("#pl-x").onclick = () => box.remove();
})();
