// backend/socket/index.js
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db'); 
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
    // nhóm groups
    socket.on('join:group', ({ groupId }) => {
      socket.join(`group_${groupId}`);
      console.log(`User ${socket.id} joined group ${groupId}`);
    });

    socket.on('group:message', ({ groupId, content, sender }) => {
      // Tạm thời chưa lưu DB, chỉ broadcast
      io.to(`group_${groupId}`).emit('group:message', { groupId, content, sender });
    });
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
    socket.on('friend:send_request', async ({ senderId, receiverId }) => {
      try {
        // Lấy tên người gửi
        const senderRes = await pool.query(
          `SELECT username FROM users WHERE id = $1`,
          [senderId]
        );
        const senderName = senderRes.rows[0]?.username || 'Người dùng';
    
        const message = `<i class="fa-solid fa-user-plus"></i> ${senderName} đã gửi lời mời kết bạn`;
    
        // 1. Tạo thông báo trong DB
        const { rows } = await pool.query(
          `INSERT INTO notifications (user_id, sender_id, type, message, is_read, created_at)
           VALUES ($1, $2, 'friend_request', $3, false, NOW()) RETURNING *`,
          [receiverId, senderId, message]
        );
        const notif = rows[0];
    
        // 2. Nếu receiver đang online -> emit realtime cho họ
        const recvSocketId = onlineUsers.get(String(receiverId));
        if (recvSocketId) {
          io.to(recvSocketId).emit('friend:request_received', { senderId, receiverId });
          io.to(recvSocketId).emit('notification:new', notif);
        }
    
        // 3. Xác nhận cho sender
        socket.emit('friend:request_sent', { senderId, receiverId });
      } catch (err) {
        console.error('Lỗi tạo thông báo friend_request:', err);
      }
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
    // call video 
// socket/index.js
socket.on('call:init', async ({ calleeId, type }) => {
  if (!socket.userId) return;

  // 🚀 encode type vào rtcRoomId
  const rtcRoomId = `${type || 'voice'}-${uuidv4()}`;

  const { rows } = await pool.query(
    `INSERT INTO calls (caller_id, callee_id, rtc_room_id, status) 
     VALUES ($1,$2,$3,'ringing') RETURNING id`,
    [socket.userId, calleeId, rtcRoomId]
  );
  const callId = rows[0].id;

  // Lấy thông tin caller
  const callerRes = await pool.query(
    `SELECT id, username, avatar FROM users WHERE id=$1`,
    [socket.userId]
  );
  const caller = callerRes.rows[0];

  // Gửi cho callee
  io.to(`user_${calleeId}`).emit('call:ring', {
    callId,
    rtcRoomId,
    from: caller,
    type: type || 'voice'   // 👈 gửi kèm type
  });

  // Gửi cho caller
  socket.emit('call:created', { callId, rtcRoomId, type: type || 'voice' });
});

    
    
    
    socket.on('call:accept', async ({ callId }) => {
      const { rows } = await pool.query(`UPDATE calls SET status='accepted', answered_at=NOW() WHERE id=$1 RETURNING *`, [callId]);
      const call = rows[0];
      io.to(`user_${call.caller_id}`).emit('call:accepted', { callId, rtcRoomId: call.rtc_room_id });
    });
    
    function attachType(call) {
      return {
        ...call,
        type: call.rtc_room_id?.startsWith('video-') ? 'video' : 'voice'
      };
    }
    
    socket.on('call:reject', async ({ callId }) => {
      const { rows } = await pool.query(
        `UPDATE calls SET status='rejected', ended_at=NOW() WHERE id=$1 RETURNING *`, [callId]
      );
      let call = rows[0];
      call = attachType(call);
    
      io.to(`user_${call.caller_id}`).emit('call:rejected', call);
      io.to(`user_${call.callee_id}`).emit('call:rejected', call);
    });
    
    socket.on('call:end', async ({ callId }) => {
      const { rows } = await pool.query(`SELECT * FROM calls WHERE id=$1`, [callId]);
      const call = rows[0];
      let updated;
    
      if (!call.answered_at) {
        const res = await pool.query(
          `UPDATE calls 
           SET status='missed', ended_at=NOW(), duration=NULL 
           WHERE id=$1 RETURNING *`,
          [callId]
        );
        updated = res.rows[0];
      } else {
        const res = await pool.query(
          `UPDATE calls 
           SET status='ended', ended_at=NOW(),
               duration=EXTRACT(EPOCH FROM (NOW() - answered_at))::int
           WHERE id=$1 RETURNING *`,
          [callId]
        );
        updated = res.rows[0];
      }
    
      updated = attachType(updated);
    
      io.to(`user_${updated.caller_id}`).emit('call:ended', updated);
      io.to(`user_${updated.callee_id}`).emit('call:ended', updated);
    });
    
    
    
    
    
    // Relay ICE/SDP
    socket.on('rtc:offer', ({ rtcRoomId, sdp }) => {
      console.log('[SIGNAL] Offer relayed to room', rtcRoomId);
      socket.to(rtcRoomId).emit('rtc:offer', { rtcRoomId, sdp, from: socket.userId });
    });
    
    socket.on('rtc:answer', ({ rtcRoomId, sdp }) => {
      console.log('[SIGNAL] Answer relayed to room', rtcRoomId);
      socket.to(rtcRoomId).emit('rtc:answer', { rtcRoomId, sdp, from: socket.userId });
    });
    
    socket.on('rtc:candidate', ({ rtcRoomId, candidate }) => {
      console.log('[SIGNAL] Candidate relayed to room', rtcRoomId);
      socket.to(rtcRoomId).emit('rtc:candidate', { rtcRoomId, candidate, from: socket.userId });
    });
    
    // --- JOIN RTC ROOM (important) ---
    socket.on('join:rtc', ({ rtcRoomId }) => {
  if (!rtcRoomId) return;
  try {
    socket.join(rtcRoomId);
    console.log(`Socket ${socket.id} joined rtc room ${rtcRoomId} (user ${socket.userId})`);
  } catch (err) {
    console.error('join:rtc error', err);
  }
    });
    // socket/index.js (thêm dưới phần socket.on('connection'))
    socket.on('notification:send', async ({ receiverId, message, type }) => {
  if (!socket.userId) return;

  try {
    // lưu DB
    const { rows } = await pool.query(
      `INSERT INTO notifications (user_id, message, type, is_read, created_at) 
       VALUES ($1,$2,$3,false,NOW()) RETURNING *`,
      [receiverId, message, type || 'general']
    );
    const notif = rows[0];

    // nếu user online thì gửi realtime
    const recvSock = onlineUsers.get(String(receiverId));
    if (recvSock) {
      io.to(recvSock).emit('notification:new', notif);
    }
  } catch (err) {
    console.error('Lỗi lưu notification', err);
  }
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