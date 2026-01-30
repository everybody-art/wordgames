# Word Games - Questions & Answers Implementation Spec

## Project Overview
Build a simple real-time multiplayer word game using Cloudflare Workers, Durable Objects, and WebSockets. Start with "Questions & Answers" as the MVP.

## Game: Questions & Answers
Two players join a game session via shared URL. One writes a question, the other writes an answer, both simultaneously without seeing each other's input. When both submit, answers are revealed together for comedic effect.

## Technology Stack
- **Cloudflare Workers** - Entry point, request routing
- **Cloudflare Durable Objects** - Game session state and WebSocket coordination
- **Cloudflare Pages** - Static frontend hosting
- **WebSockets** - Real-time bidirectional communication
- **No external database** - All state is ephemeral in-memory

## Architecture

### URL Structure
- `https://wordgames.example.com/` - Landing page with "Create Game" button
- `https://wordgames.example.com/game/{gameId}` - Game session page
- Game IDs are randomly generated (e.g., `adjective-noun-number` like `purple-elephant-42`)

### Data Flow
1. Player 1 clicks "Create Game", gets redirected to `/game/{newGameId}`
2. Player 1 shares URL with Player 2
3. Both players load the game page, establish WebSocket connections to the same Durable Object
4. Both players write their text simultaneously
5. Both players click submit (which disables their input)
6. When both have submitted, Durable Object broadcasts reveal payload
7. Frontend displays both answers together

### Durable Object: GameSession

**Responsibilities:**
- Accept and manage WebSocket connections
- Track player submissions
- Broadcast state updates to all connected clients
- Handle reveal logic

**State Structure:**
```javascript
{
  players: {
    'player-1-id': {
      role: 'question' | 'answer',
      connected: true,
      submitted: false,
      content: null
    },
    'player-2-id': { ... }
  },
  gameState: 'waiting' | 'ready' | 'playing' | 'revealed'
}
```

**WebSocket Message Types:**

*Client → Server:*
```javascript
{ type: 'join', playerId: 'uuid' }
{ type: 'submit', playerId: 'uuid', content: 'text content' }
```

*Server → Client:*
```javascript
{ type: 'state_update', gameState: 'ready', playerCount: 2, yourRole: 'question' }
{ type: 'player_submitted', playerId: 'uuid' }
{ type: 'reveal', question: 'text', answer: 'text' }
{ type: 'error', message: 'error description' }
```

**Methods:**
- `constructor(state, env)` - Initialize DO instance
- `fetch(request)` - Upgrade HTTP to WebSocket
- `webSocketMessage(ws, message)` - Handle incoming WebSocket messages
- `webSocketClose(ws, code, reason)` - Handle disconnections
- `handleJoin(ws, data)` - Assign role, notify other players
- `handleSubmit(ws, data)` - Store submission, check if both ready, trigger reveal
- `broadcast(message)` - Send message to all connected WebSockets
- `assignRole()` - Determine if player is 'question' or 'answer' writer

### Worker: Request Router

**Responsibilities:**
- Route requests to appropriate Durable Objects
- Generate game IDs
- Serve static assets (delegate to Pages)

**Routes:**
- `GET /` - Serve landing page
- `GET /game/{gameId}` - Serve game page
- `GET /ws/{gameId}` - Upgrade to WebSocket, proxy to Durable Object

**Implementation:**
```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // WebSocket upgrade for game sessions
    if (url.pathname.startsWith('/ws/')) {
      const gameId = url.pathname.split('/')[2];
      const id = env.GAME_SESSION.idFromName(gameId);
      const stub = env.GAME_SESSION.get(id);
      return stub.fetch(request);
    }
    
    // Static pages handled by Pages
    // or return simple HTML responses for MVP
  }
}
```

### Frontend

**Landing Page (`/`):**
- Single "Create Game" button
- Generates random game ID client-side
- Redirects to `/game/{gameId}`

**Game Page (`/game/{gameId}`):**

*UI Elements:*
- Game ID display with "Copy Link" button
- Player count indicator (e.g., "1/2 players")
- Role display ("You are writing the: Question" or "Answer")
- Large textarea for input
- Submit button (disabled until input has content)
- Waiting indicator ("Waiting for other player to submit...")
- Reveal area (shows both question and answer after submission)

*WebSocket Connection:*
```javascript
const ws = new WebSocket(`wss://${location.host}/ws/${gameId}`);
const playerId = crypto.randomUUID();

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'join', playerId }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle different message types
};
```

*State Management:*
- Track local submission status
- Disable input after submit
- Show/hide waiting indicator
- Render reveal when both submitted

## File Structure
```
wordgames/
├── wrangler.toml                 # Cloudflare config
├── src/
│   ├── index.js                  # Worker entry point
│   ├── game-session.js           # Durable Object class
│   └── utils.js                  # ID generation, etc.
└── public/
    ├── index.html                # Landing page
    └── game.html                 # Game page with inline JS
```

## Configuration (wrangler.toml)
```toml
name = "wordgames"
main = "src/index.js"
compatibility_date = "2025-01-30"

[[durable_objects.bindings]]
name = "GAME_SESSION"
class_name = "GameSession"

[[migrations]]
tag = "v1"
new_classes = ["GameSession"]
```

## Development Workflow
1. `npm create cloudflare@latest wordgames`
2. Choose "Hello World" Worker template
3. Add Durable Object class
4. Configure wrangler.toml
5. `wrangler dev` for local development
6. `wrangler deploy` when ready

## MVP Scope - What's Included
- Single game type (Questions & Answers)
- Two-player only
- No persistence (game dies when both disconnect)
- No game history/replay
- No player names
- Simple CSS, no framework
- Direct WebSocket messages (no reconnection logic)

## MVP Scope - What's Excluded
- Multiple game types
- Lobby/matchmaking
- More than 2 players
- Game replay/history
- Player authentication
- Fancy animations
- Mobile-optimized UI
- Reconnection handling
- Error recovery
- Analytics

## Success Criteria
1. Two people can open the same game URL
2. Both can see when the other has joined
3. Both can write and submit text
4. Reveal shows both submissions together
5. Works in Chrome/Firefox/Safari
6. Deploys to Cloudflare free tier

## Next Steps After MVP
1. Add "Conditionals" game (just change labels, same mechanics)
2. Extract common game engine patterns
3. Add game type selector
4. Implement other games from the list
5. Add reconnection logic
6. Polish UI/UX
7. Write DEV.to article about the implementation

## Notes for Implementation
- Use `idFromName(gameId)` for DO routing (simpler than tracking IDs)
- WebSocket Hibernation API not needed for MVP (active games are short)
- Generate game IDs client-side to avoid extra API call
- Store minimal state in DO (just current round data)
- Use `getWebSockets()` to broadcast to all connections
- No need for SQLite storage (everything is ephemeral)
