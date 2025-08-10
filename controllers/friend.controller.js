// backend/controllers/friend.controller.js
const pool = require('../db');

// 📤 Gửi lời mời kết bạn
exports.sendFriendRequest = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId } = req.body;

    if (senderId === receiverId) {
      return res.status(400).json({ message: 'Không thể kết bạn với chính mình' });
    }

    // Check đã là bạn bè chưa
    const isFriend = await pool.query(
      `SELECT 1 FROM friends 
       WHERE (user1_id=$1 AND user2_id=$2) OR (user1_id=$2 AND user2_id=$1)`,
      [senderId, receiverId]
    );
    if (isFriend.rowCount > 0) {
      return res.status(400).json({ message: 'Đã là bạn bè' });
    }

    // Check đã gửi lời mời chưa
    const pending = await pool.query(
      `SELECT 1 FROM friend_requests 
       WHERE (sender_id=$1 AND receiver_id=$2) 
          OR (sender_id=$2 AND receiver_id=$1)`,
      [senderId, receiverId]
    );
    if (pending.rowCount > 0) {
      return res.status(400).json({ message: 'Đã có lời mời đang chờ' });
    }

    await pool.query(
      `INSERT INTO friend_requests (sender_id, receiver_id) VALUES ($1, $2)`,
      [senderId, receiverId]
    );

    res.json({ message: 'Đã gửi lời mời kết bạn' });
  } catch (err) {
    console.error('Lỗi gửi lời mời:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// 📥 Lấy danh sách lời mời nhận được
exports.getReceivedRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT fr.id, fr.sender_id, u.username, u.avatar, fr.created_at
       FROM friend_requests fr
       JOIN users u ON fr.sender_id = u.id
       WHERE fr.receiver_id = $1`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Lỗi lấy lời mời:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// ✅ Chấp nhận lời mời
exports.acceptRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;

    // Lấy thông tin lời mời
    const request = await pool.query(
      `SELECT sender_id, receiver_id FROM friend_requests WHERE id=$1 AND receiver_id=$2`,
      [requestId, userId]
    );
    if (request.rowCount === 0) {
      return res.status(404).json({ message: 'Lời mời không tồn tại' });
    }

    const { sender_id, receiver_id } = request.rows[0];

    // Thêm vào bảng bạn bè
    await pool.query(
      `INSERT INTO friends (user1_id, user2_id) VALUES ($1, $2)`,
      [sender_id, receiver_id]
    );

    // Xóa khỏi friend_requests
    await pool.query(`DELETE FROM friend_requests WHERE id=$1`, [requestId]);

    res.json({ message: 'Đã chấp nhận lời mời kết bạn' });
  } catch (err) {
    console.error('Lỗi chấp nhận lời mời:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// ❌ Từ chối lời mời
exports.declineRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;

    await pool.query(
      `DELETE FROM friend_requests WHERE id=$1 AND receiver_id=$2`,
      [requestId, userId]
    );

    res.json({ message: 'Đã từ chối lời mời kết bạn' });
  } catch (err) {
    console.error('Lỗi từ chối lời mời:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// 🚫 Hủy kết bạn
exports.unfriend = async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;

    await pool.query(
      `DELETE FROM friends 
       WHERE (user1_id=$1 AND user2_id=$2) OR (user1_id=$2 AND user2_id=$1)`,
      [userId, friendId]
    );

    res.json({ message: 'Đã hủy kết bạn' });
  } catch (err) {
    console.error('Lỗi hủy kết bạn:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
};


// 📌 Lấy trạng thái kết bạn
exports.getFriendStatus = async (req, res) => {
    try {
      const userId = req.user.id;
      const targetId = parseInt(req.params.userId);
  
      // Đã là bạn bè?
      const friend = await pool.query(
        `SELECT 1 FROM friends 
         WHERE (user1_id=$1 AND user2_id=$2) OR (user1_id=$2 AND user2_id=$1)`,
        [userId, targetId]
      );
      if (friend.rowCount > 0) {
        return res.json({ status: 'friends' });
      }
  
      // Đang chờ mình chấp nhận?
      const received = await pool.query(
        `SELECT id FROM friend_requests WHERE sender_id=$1 AND receiver_id=$2`,
        [targetId, userId]
      );
      if (received.rowCount > 0) {
        return res.json({
          status: 'request-received',
          requestId: received.rows[0].id
        });
      }
  
      // Mình đã gửi lời mời?
      const sent = await pool.query(
        `SELECT id FROM friend_requests WHERE sender_id=$1 AND receiver_id=$2`,
        [userId, targetId]
      );
      if (sent.rowCount > 0) {
        return res.json({ status: 'request-sent' });
      }
  
      // Không có gì
      res.json({ status: 'none' });
    } catch (err) {
      console.error('Lỗi lấy trạng thái:', err);
      res.status(500).json({ message: 'Lỗi server' });
    }
  };
  
  