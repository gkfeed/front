import { createHttpServer } from './httpServer.js';

const port = Number(process.env.PORT ?? 3000);

const server = createHttpServer();

server.listen(port, '0.0.0.0', () => {
  console.log(`GKFeed BFF listening on http://0.0.0.0:${port}`);
});
