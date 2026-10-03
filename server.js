// Roblox Player Lookup — local server (Node 18+, no dependencies)
// Run:  node server.js   then open http://localhost:3100
//
// Why run this locally? The web version on Netlify can only show public data,
// because a browser is not allowed to send your Roblox login to roblox.com.
// This local server can attach a login you provide, so you get accurate online
// status and the lists Roblox only shows to logged-in viewers. Your cookie is
// held in this process only and sent to roblox.com and nowhere else.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { lookup, outfitDetails } = require("./roblox-core.js");

const PORT = process.env.PORT || 3100;

// Optional login from a file, as a convenience. The browser can also send one
// per request (see the X-Roblox-Cookie header below), which overrides this.
function fileCookie() {
  try {
    const v = fs.readFileSync(path.join(__dirname, "roblox-cookie.txt"), "utf8").trim();
    return v.replace(/^\.ROBLOSECURITY=/, "").replace(/;.*$/, "") || null;
  } catch { return process.env.ROBLOSECURITY || null; }
}
const FILE_COOKIE = fileCookie();

function send(res, status, body, type = "application/json") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    // Allow the Netlify-hosted page to call this local server.
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Roblox-Cookie",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

function cookieFrom(req) {
  const header = req.headers["x-roblox-cookie"];
  if (header && String(header).length > 20) return String(header).replace(/^\.ROBLOSECURITY=/, "").replace(/;.*$/, "");
  return FILE_COOKIE;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "OPTIONS") return send(res, 204, "");
  try {
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return send(res, 200, fs.readFileSync(path.join(__dirname, "index.html")), "text/html; charset=utf-8");
    }
    if (url.pathname === "/userscript.js") {
      return send(res, 200, fs.readFileSync(path.join(__dirname, "userscript.js")), "text/javascript; charset=utf-8");
    }
    const ctx = { cookie: cookieFrom(req) };
    if (url.pathname === "/api/health") return send(res, 200, { ok: true, login: !!ctx.cookie });
    if (url.pathname === "/api/lookup") return send(res, 200, await lookup(ctx, url.searchParams.get("q"), { log: console.log }));
    if (url.pathname === "/api/outfit") {
      const id = url.searchParams.get("id");
      if (!/^\d+$/.test(id || "")) return send(res, 400, { error: "Invalid outfit id." });
      return send(res, 200, await outfitDetails(ctx, id));
    }
    send(res, 404, { error: "Not found" });
  } catch (err) {
    send(res, 502, { error: err.message || "Something went wrong talking to Roblox." });
  }
}).listen(PORT, () => {
  console.log(`Player Lookup running at http://localhost:${PORT}`);
  console.log(FILE_COOKIE ? "Login file found: logged-in data available." : "No login file. The app can still send a login you paste in, or run without one.");
});
