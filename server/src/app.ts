import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import notificationsRouter from './routes/notifications';
import syncRouter from './routes/sync';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

import groupsRouter from './routes/groups';

app.use('/notifications', notificationsRouter);
app.use('/sync-members', syncRouter);
app.use('/groups', groupsRouter);

app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'CP5 API', timestamp: Date.now() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
