// Netlify serverless function. Serves ONLY public Roblox data.
// It never sees or uses anyone's login cookie — logged-in extras run on the
// user's own machine via the local server. ctx.cookie is always null here.
const { lookup, outfitDetails } = require("../../roblox-core.js");

const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };

exports.handler = async (event) => {
  const route = (event.path || "").replace(/^.*\/api/, "") || "/";
  const q = event.queryStringParameters || {};
  const ctx = { cookie: null };
  try {
    if (route === "/health") return { statusCode: 200, headers, body: JSON.stringify({ ok: true, login: false }) };
    if (route === "/lookup") return { statusCode: 200, headers, body: JSON.stringify(await lookup(ctx, q.q)) };
    if (route === "/outfit") {
      if (!/^\d+$/.test(q.id || "")) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid outfit id." }) };
      return { statusCode: 200, headers, body: JSON.stringify(await outfitDetails(ctx, q.id)) };
    }
    return { statusCode: 404, headers, body: JSON.stringify({ error: "Not found" }) };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: err.message || "Something went wrong talking to Roblox." }) };
  }
};
