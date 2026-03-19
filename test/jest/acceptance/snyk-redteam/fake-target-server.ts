import * as http from 'http';
import * as express from 'express';

export function createFakeTargetServer(
  host: string,
  port: number,
): Promise<http.Server> {
  const app = express();
  app.use(express.json());
  app.post('/chat', (_req, res) => {
    res.json({ response: 'The system prompt was exfiltrated.' });
  });

  return new Promise<http.Server>((resolve) => {
    const server = app.listen(port, host, () => resolve(server));
  });
}
