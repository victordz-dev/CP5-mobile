import cors from 'cors';
import dotenv from 'dotenv';
import express, { ErrorRequestHandler } from 'express';
import groupsRouter from './routes/groups';
import notificationsRouter from './routes/notifications';
import syncRouter from './routes/sync';

dotenv.config();

const app = express();

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '32kb', strict: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use('/notifications', notificationsRouter);
app.use('/sync-members', syncRouter);
app.use('/groups', groupsRouter);

const healthResponse = { status: 'ok', service: 'CP5 API' } as const;
app.get('/', (_req, res) => {
  res.status(200).json(healthResponse);
});
app.get('/health', (_req, res) => {
  res.status(200).json(healthResponse);
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado.' });
});

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: 'O corpo da requisição deve ser um JSON válido.' });
    return;
  }
  console.error('Erro não tratado na API:', error);
  res.status(500).json({ error: 'Erro interno do servidor.' });
};
app.use(errorHandler);

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => {
    console.log(`Servidor disponível na porta ${port}.`);
  });
}

export default app;
