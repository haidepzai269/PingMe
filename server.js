require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const socketHandler = require('./socket'); // backend/socket/index.js

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// ===== Routes =====
const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const userRoutes = require('./routes/user.routes');
const friendRoutes = require('./routes/friend.routes');

app.use('/api/auth', authRoutes);
app.use('/api/users', profileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);

// Khi vào / => mở auth.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'auth.html'));
});

// ===== Tạo HTTP server & Socket.IO =====
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // TODO: thay bằng domain FE khi deploy
    methods: ['GET', 'POST']
  }
});

// Start socket handlers
socketHandler(io);

// ===== Start server =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
