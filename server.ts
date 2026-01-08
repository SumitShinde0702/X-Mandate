import express from 'express';
import cors from 'cors';
import { XAG } from './src/XAG';
import path from 'path';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const frontendPath = path.join(process.cwd(), 'frontend');

// Serve landing page at root FIRST (before static middleware)
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'index.html'));
});

// Serve demo at /demo
app.get('/demo', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Serve static files from frontend directory (but NOT index.html - we handle that above)
app.use('/static', express.static(frontendPath));

const xag = new XAG();

// Connect to XRPL on startup
xag.connect().catch(console.error);

// API Routes
app.post('/api/create-agent', async (req, res) => {
  try {
    const agent = await xag.createAgent(req.body);
    res.json(agent);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/initiate-trade', async (req, res) => {
  try {
    const { buyerSeed, ...config } = req.body;
    const trade = await xag.initiateTrade(config, buyerSeed);
    res.json(trade);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/fulfill-trade', async (req, res) => {
  try {
    const { sellerSeed, ...params } = req.body;
    const hash = await xag.fulfillTrade(
      params.escrowHash,
      params.sellerDID,
      params.token || 'XRP',
      sellerSeed
    );
    res.json({ hash });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reputation/:did', async (req, res) => {
  try {
    const reputation = await xag.getReputation(req.params.did);
    res.json(reputation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/log', async (req, res) => {
  try {
    const { message, level, agentDID, agentSeed } = req.body;
    if (!message || !agentDID) {
      return res.status(400).json({ error: 'Message and agentDID are required' });
    }
    const hash = await xag.log(message, level || 'info', agentDID, agentSeed);
    res.json({ hash, message, level: level || 'info' });
  } catch (error: any) {
    console.error('Log error:', error);
    res.status(500).json({ error: error.message || 'Failed to log to blockchain' });
  }
});

app.get('/api/logs/:did', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await xag.getLogs(req.params.did, limit);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/history/:did', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const history = await xag.getTransactionHistory(req.params.did, limit);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 XAG Server running on http://localhost:${port}`);
  console.log(`📱 Frontend available at http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await xag.disconnect();
  process.exit(0);
});

