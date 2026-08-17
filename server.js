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

            if (lobby.game === "mafia" && lobby.clients.length >= 3) {
                assignMafiaRoles(lobby);
            }
            if (lobby.game === "bunker") {
                assignBunkerCards(lobby);
            }
        }

        if (data.type === "game-msg") {
            const code = ws.lobbyCode;
            const lobby = lobbies[code];
            if (!lobby) return;

            // тут можно обрабатывать ночные действия/голосования
            // пока просто рассылаем всем
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
        if (lobbies[code].clients.length === 0) delete lobbies[code];
    });
});

function assignMafiaRoles(lobby) {
    const baseRoles = ["Мафия","Доктор","Детектив"];
    const roles = [];

    lobby.clients.forEach((_, i) => {
        roles.push(baseRoles[i] || "Мирный");
    });

    lobby.clients.forEach((client, i) => {
        client.send(JSON.stringify({
            type: "game-msg",
            game: "mafia",
            payload: {action: "role", role: roles[i]}
        }));
    });

    lobby.clients.forEach((client) => {
        client.send(JSON.stringify({
            type: "game-msg",
            game: "mafia",
            payload: {action: "phase", phase: "night"}
        }));
    });
}

function assignBunkerCards(lobby) {
    lobby.clients.forEach((client) => {
        const cards = genBunkerAttributes();
        client.send(JSON.stringify({
            type: "game-msg",
            game: "bunker",
            payload: {action: "cards", cards}
        }));
    });
}

/* тот же генератор, что и на клиенте — можно вынести в общий файл */
function genBunkerAttributes() {
    const profs = ["Врач","Инженер","Учитель","Фермер","Военный","Программист"];
    const health = ["Идеальное","Хроническое заболевание","Инвалидность","Среднее"];
    const ages = ["18","25","35","45","60"];
    const baggage = ["Аптечка","Инструменты","Еда на месяц","Оружие","Книги"];
    const hobbies = ["Спорт","Музыка","Рисование","Рыбалка","Психология"];

    return {
        prof: randomFrom(profs),
        health: randomFrom(health),
        age: randomFrom(ages),
        baggage: randomFrom(baggage),
        hobby: randomFrom(hobbies)
    };
}
function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

console.log("Server started");
