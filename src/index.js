export { GameSession } from "./game-session.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // WebSocket upgrade for game sessions
    const wsMatch = path.match(/^\/ws\/(.+)$/);
    if (wsMatch) {
      const gameId = wsMatch[1];
      const id = env.GAME_SESSION.idFromName(gameId);
      const stub = env.GAME_SESSION.get(id);
      return stub.fetch(request);
    }

    // Game page
    const gameMatch = path.match(/^\/game\/(.+)$/);
    if (gameMatch) {
      const assetRes = await env.ASSETS.fetch(new Request(new URL("/game.html", url.origin)));
      // Return the HTML body with the original URL preserved (no redirect)
      return new Response(assetRes.body, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // Everything else falls through to static assets (index.html, etc.)
    return env.ASSETS.fetch(request);
  }
};
