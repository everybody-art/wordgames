import { DurableObject } from "cloudflare:workers";

export class GameSession extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.players = new Map();
    this.gameState = "waiting"; // waiting | playing | revealed
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 400 });
    }

    if (this.players.size >= 2) {
      return new Response("Game is full", { status: 403 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);

    const playerId = crypto.randomUUID();
    const role = this.players.size === 0 ? "question" : "answer";

    server.serializeAttachment({ playerId, role, submission: null });
    this.players.set(playerId, { role, submission: null });

    if (this.players.size === 2) {
      this.gameState = "playing";
    }

    // Send the joining player their info after connection opens
    server.send(JSON.stringify({
      type: "joined",
      playerId,
      role,
      playerCount: this.players.size,
      gameState: this.gameState
    }));

    // Broadcast updated player count to all
    this.broadcast({
      type: "state",
      playerCount: this.players.size,
      gameState: this.gameState
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    const data = JSON.parse(message);
    const attachment = ws.deserializeAttachment();

    switch (data.type) {
      case "submit":
        this.handleSubmit(ws, attachment, data.content);
        break;
    }
  }

  async webSocketClose(ws, code, reason) {
    const attachment = ws.deserializeAttachment();
    if (attachment) {
      this.players.delete(attachment.playerId);
      if (this.gameState !== "revealed") {
        this.gameState = this.players.size > 0 ? "waiting" : "waiting";
      }
      this.broadcast({
        type: "state",
        playerCount: this.players.size,
        gameState: this.gameState
      });
    }
    ws.close();
  }

  async webSocketError(ws, error) {
    const attachment = ws.deserializeAttachment();
    if (attachment) {
      this.players.delete(attachment.playerId);
    }
    ws.close();
  }

  handleSubmit(ws, attachment, content) {
    if (this.gameState !== "playing") return;

    attachment.submission = content;
    ws.serializeAttachment(attachment);
    this.players.set(attachment.playerId, {
      role: attachment.role,
      submission: content
    });

    ws.send(JSON.stringify({ type: "submitted" }));

    // Check if both players have submitted
    const allPlayers = [...this.players.values()];
    if (allPlayers.length === 2 && allPlayers.every(p => p.submission)) {
      this.gameState = "revealed";
      const question = allPlayers.find(p => p.role === "question");
      const answer = allPlayers.find(p => p.role === "answer");
      this.broadcast({
        type: "reveal",
        question: question.submission,
        answer: answer.submission
      });
    }
  }

  broadcast(message) {
    const msg = typeof message === "string" ? message : JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(msg);
      } catch (e) {
        // socket likely closed
      }
    }
  }
}
