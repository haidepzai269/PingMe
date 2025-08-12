// backend/socket/index.js
const jwt = require('jsonwebtoken');

function socketHandler(io) {
  const onlineUsers = new Map(); // userId -> socketId

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // Nếu handshake có token thì verify
    if (socket.handshake?.auth?.token) {
      try {
        const payload = jwt.verify(socket.handshake.auth.token, process.env.ACCESS_TOKEN_SECRET);
        socket.userId = payload.id ?? payload.userId ?? payload.sub;
        onlineUsers.set(String(socket.userId), socket.id);
        console.log('Registered via handshake token userId=', socket.userId);

        // Join room cá nhân
        console.log('User connected:', socket.userId);
        socket.join(`user_${socket.userId}`);

        // Báo cho mọi người user này online
        socket.broadcast.emit('user:online', { userId: socket.userId });
        // Gửi danh sách online cho người vừa connect
        socket.emit('users:online_list', { online: Array.from(onlineUsers.keys()) });

      } catch (err) {
        console.log('Socket handshake token invalid, client should register manually');
      }
    }

    // Client tự đăng ký sau khi login HTTP
    socket.on('register', (userId) => {
      if (!userId) return;
      socket.userId = String(userId);
      onlineUsers.set(socket.userId, socket.id);
      console.log(`Socket ${socket.id} registered for user ${userId}`);

      // Join room cá nhân
      console.log('User connected:', socket.userId);
      socket.join(`user_${socket.userId}`);

      // Báo cho mọi người user này online
      socket.broadcast.emit('user:online', { userId });
      // Gửi danh sách online cho người vừa connect
      socket.emit('users:online_list', { online: Array.from(onlineUsers.keys()) });
    });

    // Friend request events
    socket.on('friend:send_request', ({ senderId, receiverId }) => {
      const recvSocketId = onlineUsers.get(String(receiverId));
      if (recvSocketId) {
        io.to(recvSocketId).emit('friend:request_received', { senderId, receiverId });
      }
      socket.emit('friend:request_sent', { senderId, receiverId });
    });

    socket.on('friend:accept_request', ({ senderId, receiverId }) => {
      const senderSock = onlineUsers.get(String(senderId));
      if (senderSock) {
        io.to(senderSock).emit('friend:request_accepted', { senderId, receiverId });
      }
      const recvSock = onlineUsers.get(String(receiverId));
      if (recvSock) io.to(recvSock).emit('friend:update_count', { userId: receiverId });
      socket.emit('friend:update_count', { userId: senderId });
    });

    socket.on('friend:decline_request', ({ senderId, receiverId }) => {
      const senderSock = onlineUsers.get(String(senderId));
      if (senderSock) {
        io.to(senderSock).emit('friend:request_declined', { senderId, receiverId });
      }
    });
    // block real time 
    // Thêm event nhận từ client khi block/unblock
    socket.on('block:user', async ({ blockedUserId, action }) => {
  // action: 'block' hoặc 'unblock'
  const blockerId = socket.userId;
  if (!blockerId || !blockedUserId) return;

  // Phát event cho cả 2 người: blocker và blockedUser
  [blockerId, blockedUserId].forEach(userId => {
    const sockId = onlineUsers.get(String(userId));
    if (sockId) {
      io.to(sockId).emit('block:update', {
        blockerId,
        blockedUserId,
        action
      });
    }
  });
    });

    socket.on('friend:unfriend', ({ userId, friendId }) => {
      const friendSock = onlineUsers.get(String(friendId));
      if (friendSock) {
        io.to(friendSock).emit('friend:unfriended', { by: userId, friendId });
      }
      socket.emit('friend:update_count', { userId });
    });

    // Disconnect
    socket.on('disconnect', () => {
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        socket.broadcast.emit('user:offline', { userId: socket.userId });
        console.log(`User ${socket.userId} offline`);
      } else {
        console.log('Socket disconnected', socket.id);
      }

      console.log('User disconnected:', socket.userId);
    });
  });
}

module.exports = socketHandler;