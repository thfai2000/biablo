import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { GameConfig } from '../types/game-config';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../../public')));

// Serve the game config
app.get('/api/config', (req, res) => {
  const configPath = path.join(__dirname, '../../config', 'game-config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as GameConfig;
  res.json(config);
});

// Serve the main game page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public', 'index.html'));
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});