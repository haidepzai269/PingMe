require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const socketHandler = require('./socket'); // backend/socket/index.js
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const jwt = require("jsonwebtoken");


const app = express();
app.use(cors());
app.use(express.json());
// Khi vào / => mở auth.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'auth.html'));
});
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
// đăng nhập bằng fb & gg
// Serialize / Deserialize user (ở đây chỉ cần pass object, không dùng session DB)
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// === GOOGLE ===
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    const username = profile.displayName || email;
    const avatar = profile.photos?.[0]?.value || null;

    // Tìm user theo email
    let result = await pool.query("SELECT * FROM users WHERE email=$1", [email]);

    let user;
    if (result.rows.length === 0) {
      // Nếu chưa có -> tạo mới
      const insert = await pool.query(
        "INSERT INTO users (username, password, email, avatar) VALUES ($1,$2,$3,$4) RETURNING *",
        [username, "", email, avatar]
      );
      user = insert.rows[0];
    } else {
      user = result.rows[0];
    }

    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

// === FACEBOOK ===
// passport.use(new FacebookStrategy({
//   clientID: process.env.FACEBOOK_APP_ID,
//   clientSecret: process.env.FACEBOOK_APP_SECRET,
//   callbackURL: "http://localhost:3000/api/auth/facebook/callback",
//   profileFields: ["id", "emails", "displayName", "photos"]
// }, async (accessToken, refreshToken, profile, done) => {
//   try {
//     const email = profile.emails?.[0]?.value || `${profile.id}@facebook.com`;
//     const username = profile.displayName || email;
//     const avatar = profile.photos?.[0]?.value || null;

//     let result = await pool.query("SELECT * FROM users WHERE email=$1", [email]);

//     let user;
//     if (result.rows.length === 0) {
//       const insert = await pool.query(
//         "INSERT INTO users (username, password, email, avatar) VALUES ($1,$2,$3,$4) RETURNING *",
//         [username, "", email, avatar]
//       );
//       user = insert.rows[0];
//     } else {
//       user = result.rows[0];
//     }

//     return done(null, user);
//   } catch (err) {
//     return done(err, null);
//   }
// }));

app.use(passport.initialize());

// ===== Routes OAuth =====
app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
app.get("/api/auth/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/?error=google" }),
  (req, res) => {
    // Tạo JWT từ user
    const accessToken = jwt.sign({ id: req.user.id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "15m" });
    const refreshToken = jwt.sign({ id: req.user.id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "7d" });

    // Trả về frontend (ở đây redirect kèm token query)
    res.redirect(`/home.html?accessToken=${accessToken}&refreshToken=${refreshToken}`);
  }
);

app.get("/api/auth/facebook", passport.authenticate("facebook", { scope: ["email"] }));
app.get("/api/auth/facebook/callback",
  passport.authenticate("facebook", { session: false, failureRedirect: "/?error=facebook" }),
  (req, res) => {
    const accessToken = jwt.sign({ id: req.user.id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "15m" });
    const refreshToken = jwt.sign({ id: req.user.id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "7d" });

    res.redirect(`/home.html?accessToken=${accessToken}&refreshToken=${refreshToken}`);
  }
);

// ===== Start server =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));