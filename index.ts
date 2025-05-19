import { httpServer } from "./src/http_server/index.ts";

const HTTP_PORT = 8181;
const WEBSOCKET_PORT = 3000;

httpServer.listen(HTTP_PORT);
console.log(`Start static http server on the ${HTTP_PORT} port!`);
console.log(`WebSocket server is running on the ${WEBSOCKET_PORT} port!`);
