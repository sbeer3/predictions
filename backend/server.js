const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path'); // Import the 'path' module
const categoriesRoutes = require('./routes/categories');
const predictionsModule = require('./routes/predictions');
const leaderboardRoutes = require('./routes/leaderboard');
const adminRoutes = require('./routes/admin');
const spotifyRoutes = require('./routes/spotify');
const spotlightRoutes = require('./routes/spotlight');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(bodyParser.json());

// Serve static files from the frontend's build directory
app.use(express.static(path.join(__dirname, '../oscar-frontend/build')));

// Make io instance available to routes
app.set('io', io);

// --- Routes ---
app.use('/api/categories', categoriesRoutes);
app.use('/api/predictions', predictionsModule.router);
app.use('/api/leaderboard', leaderboardRoutes.router);
app.use('/api/admin', adminRoutes);
app.use('/api/spotify', spotifyRoutes);
app.use('/api/spotlight', spotlightRoutes);

// Serve the index.html file for all other requests
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../oscar-frontend/build', 'index.html'));
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
