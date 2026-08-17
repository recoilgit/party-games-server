const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: process.env.PORT || 3000 });

const lobbies = {}; // code -> { game, clients: [] }

function genCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

wss.on("connection", (ws) => {
    ws.on("message", (msg) => {
        const data = JSON.parse(msg);

        if (data.type === "create") {
            const code = genCode();
            lobbies[code] = { game: data.game, clients: [ws] };
            ws.lobbyCode = code;
            ws.send(JSON.stringify({type: "lobby-created", code}));
        }

        if (data.type === "join") {
            const lobby = lobbies[data.code];
            if (!lobby || lobby.game !== data.game) return;
            lobby.clients.push(ws);
            ws.lobbyCode = data.code;
            ws.send(JSON.stringify({type: "lobby-joined", code: data.code}));

            // пример: раздать роли в Мафии
            if (lobby.game === "mafia" && lobby.clients.length >= 3) {
                const roles = ["Мафия", "Мирный", "Мирный", "Доктор", "Комиссар"];
                lobby.clients.forEach((client, i) => {
                    client.send(JSON.stringify({
                        type: "game-msg",
                        game: "mafia",
                        payload: {action: "role", role: roles[i] || "Мирный"}
                    }));
                });
            }
        }

        if (data.type === "game-msg") {
            const code = ws.lobbyCode;
            const lobby = lobbies[code];
            if (!lobby) return;
            lobby.clients.forEach((client) => {
                if (client !== ws) {
                    client.send(JSON.stringify({
                        type: "game-msg",
                        game: data.game,
                        payload: data.payload
                    }));
                }
            });
        }
    });

    ws.on("close", () => {
        const code = ws.lobbyCode;
        if (!code || !lobbies[code]) return;
        lobbies[code].clients = lobbies[code].clients.filter(c => c !== ws);
        if (lobbies[code].clients.length === 0) {
            delete lobbies[code];
        }
    });
});

console.log("Server started");
