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
const searchRoutes = require('./routes/search.routes');
const blockRoutes = require('./routes/block.routes');
const groupRoutes = require('./routes/group.routes');
const callRoutes = require('./routes/calls.routes');
const weatherRoutes = require('./routes/weather.js');
const notificationRoutes = require('./routes/notification.routes');

// ...



app.use('/api/auth', authRoutes);
app.use('/api/users', profileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/block', blockRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/notifications', notificationRoutes);

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
app.set('io', io); // 
// ===== Gắn io vào req cho message routes =====
const messageRoutes = require('./routes/message.routes');
app.use('/api/messages', (req, res, next) => {
  console.log(`Received ${req.method} request at /api/messages`);
  req.io = io; // Gắn io vào req để controller dùng
  next();
}, messageRoutes);
app.use('/api/groups', (req, res, next) => {
  req.io = io;
  next();
}, groupRoutes);

// Start socket handlers
socketHandler(io);
// ===== Cron job gửi thông báo thời tiết lúc 7h sáng =====
const cron = require('node-cron');
const pool = require('./db');
const { createNotification } = require('./controllers/notification.controller');
const fetchWeather = require('./utils/weather'); // bạn cần export hàm lấy thời tiết từ weather.js

// cron.schedule('0 14 * * *', async () => {
//   try {
//     console.log('⏰ Chạy cron job thời tiết 14h...');
//     const { rows: users } = await pool.query('SELECT id FROM users');
//     const weatherInfo = await fetchWeather();
//     const message = ` Thời tiết hôm nay: ${weatherInfo}`;

//     for (const u of users) {
//       const notif = await createNotification(u.id, null, 'weather', message);
//       io.to(String(u.id)).emit('notification:new', notif);
//     }

//     console.log(`✅ Đã gửi thông báo thời tiết cho ${users.length} user`);
//   } catch (err) {
//     console.error('❌ Lỗi cron job thời tiết:', err);
//   }
// }, {
//   timezone: 'Asia/Ho_Chi_Minh'
// });
cron.schedule('* 7 * * *', async () => {
  try {
    console.log('⏰ Chạy cron job thời tiết 19h...');
    const { rows: users } = await pool.query('SELECT id FROM users');
    const { description, temp, icon } = await fetchWeather();
    const message = `Thời tiết hôm nay: ${description}, ${temp}°C`;
    
    for (const u of users) {
      const notif = await createNotification(u.id, null, 'weather', message, icon);
      io.to(String(u.id)).emit('notification:new', notif);
    }
    

    console.log(`✅ Đã gửi thông báo thời tiết cho ${users.length} user`);
  } catch (err) {
    console.error('❌ Lỗi cron job thời tiết:', err);
  }
}, {
  timezone: 'Asia/Ho_Chi_Minh'
});


// ===== Start server =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));