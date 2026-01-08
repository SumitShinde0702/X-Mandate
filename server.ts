import express from 'express';
import cors from 'cors';
import { XAG } from './src/XAG';
import path from 'path';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Serve static files from frontend directory (using process.cwd() for ts-node compatibility)
const frontendPath = path.join(process.cwd(), 'frontend');
app.use(express.static(frontendPath));

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

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

app.listen(port, () => {
  console.log(`🚀 XAG Server running on http://localhost:${port}`);
  console.log(`📱 Frontend available at http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await xag.disconnect();
  process.exit(0);
});

