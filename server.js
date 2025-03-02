const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the game config
app.get('/api/config', (req, res) => {
  const configPath = path.join(__dirname, 'config', 'game-config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  res.json(config);
});

// Serve the main game page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
