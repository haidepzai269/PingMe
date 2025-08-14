// backend/controllers/message.controller.js
const pool = require('../db');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer lưu file tạm
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

exports.multerUpload = upload.single('file');

// Gửi tin nhắn
exports.sendMessage = async (req, res) => {
  const { receiver_id, content } = req.body;
  const sender_id = req.user.id;

  let media_url = null;
  let media_type = null;

  try {
    if (req.file) {
      console.log('File nhận được:', req.file);
      const ext = path.extname(req.file.originalname).toLowerCase();
      media_type = ext.match(/\.(mp4|mov|avi|mkv)$/) ? 'video' : 'image';

      const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: media_type === 'video' ? 'video' : 'image'
      });
      console.log('Kết quả upload Cloudinary:', result);
      media_url = result.secure_url;

      // Xoá file tạm
      fs.unlinkSync(req.file.path);
    }

    const query = `
    INSERT INTO messages (sender_id, receiver_id, content, media_url, media_type, unread)
    VALUES ($1, $2, $3, $4, $5, true) RETURNING *;
  `;
  const values = [sender_id, receiver_id, content || null, media_url, media_type];
  

    const { rows } = await pool.query(query, values);
    const message = rows[0];

    // Emit socket
    req.io.to(`user_${receiver_id}`).emit('message:new', message);

    res.json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi gửi tin nhắn' });
  }
};

// Lấy lịch sử tin nhắn
exports.getMessages = async (req, res) => {
  const { userId } = req.params; // id người chat cùng
  const me = req.user.id;

  try {
    const query = `
      SELECT * FROM messages
      WHERE (sender_id = $1 AND receiver_id = $2)
         OR (sender_id = $2 AND receiver_id = $1)
      ORDER BY created_at ASC;
    `;
    const { rows } = await pool.query(query, [me, userId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi lấy tin nhắn' });
  }
};
// Đánh dấu tin nhắn đã xem
exports.markAsSeen = async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user.id; // người đang thao tác

    try {
        // Lấy tin nhắn
        const { rows } = await pool.query(
            `SELECT * FROM messages WHERE id = $1`,
            [messageId]
        );
        const message = rows[0];
        if (!message) {
            return res.status(404).json({ message: 'Không tìm thấy tin nhắn' });
        }

        // Nếu là người gửi -> chỉ trả về trạng thái, không cập nhật
        if (message.sender_id === userId) {
            return res.json({ success: true, seen_at: message.seen_at });
        }

        // Nếu không phải người nhận thì cấm
        if (message.receiver_id !== userId) {
            return res.status(403).json({ message: 'Không có quyền' });
        }

        // Cập nhật seen_at
        const update = await pool.query(
          `UPDATE messages SET seen_at = NOW(), unread = false WHERE id = $1 RETURNING *`,
          [messageId]
        );
        
        const updatedMessage = update.rows[0];

        // Emit realtime cho người gửi
        req.io.to(`user_${message.sender_id}`).emit('message:seen', {
            messageId,
            seen_at: updatedMessage.seen_at
        });

        res.json({ success: true, seen_at: updatedMessage.seen_at });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Lỗi khi đánh dấu đã xem' });
    }
};
// đoạn chat gần nhất 
exports.getRecentChats = async (req, res) => {
    const me = req.user.id;
  
    try {
      // Lấy tin nhắn mới nhất với từng người chat
      const query = `
        SELECT DISTINCT ON (chat_partner_id) 
          m.id, m.sender_id, m.receiver_id, m.content, m.media_url, m.media_type, m.created_at, m.seen_at,
          u.id AS user_id, u.username, u.avatar
        FROM (
          SELECT 
            *,
            CASE 
              WHEN sender_id = $1 THEN receiver_id
              ELSE sender_id
            END AS chat_partner_id
          FROM messages
          WHERE sender_id = $1 OR receiver_id = $1
          ORDER BY created_at DESC
        ) m
        JOIN users u ON u.id = m.chat_partner_id
        ORDER BY chat_partner_id, created_at DESC
        LIMIT 50;
      `;
  
      const { rows } = await pool.query(query, [me]);
  
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Lỗi khi lấy các cuộc trò chuyện gần đây' });
    }
  };


// xóa tin nhắn 
// Xóa tin nhắn
exports.deleteMessage = async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user.id;
  
    try {
      // Lấy tin nhắn
      const { rows } = await pool.query(
        `SELECT * FROM messages WHERE id = $1`,
        [messageId]
      );
      const message = rows[0];
      if (!message) {
        return res.status(404).json({ message: 'Không tìm thấy tin nhắn' });
      }
  
      // Chỉ cho phép người gửi xóa
      if (message.sender_id !== userId) {
        return res.status(403).json({ message: 'Bạn không có quyền xóa tin nhắn này' });
      }
  
      // Nếu có media thì xóa trên Cloudinary
      if (message.media_url) {
        try {
          const publicId = message.media_url.split('/').pop().split('.')[0];
          await cloudinary.uploader.destroy(publicId, {
            resource_type: message.media_type === 'video' ? 'video' : 'image'
          });
        } catch (err) {
          console.warn('Không thể xóa file trên Cloudinary:', err.message);
        }
      }
  
      // Xóa DB
      await pool.query(`DELETE FROM messages WHERE id = $1`, [messageId]);
  
      // Gửi realtime cho cả 2 bên
      req.io.to(`user_${message.receiver_id}`).emit('message:deleted', { messageId });
      req.io.to(`user_${message.sender_id}`).emit('message:deleted', { messageId });
  
      res.json({ success: true, message: 'Đã xóa tin nhắn' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Lỗi khi xóa tin nhắn' });
    }
  };
  
  
// Lấy số lượng tin nhắn chưa đọc từ từng người
exports.getUnreadCounts = async (req, res) => {
  const me = req.user.id;

  try {
    const { rows } = await pool.query(
      `SELECT sender_id, COUNT(*) AS unread_count
       FROM messages
       WHERE receiver_id = $1 AND unread = true
       GROUP BY sender_id`,
      [me]
    );

    // Trả về object { userId: count }
    const result = {};
    rows.forEach(r => {
      result[r.sender_id] = parseInt(r.unread_count);
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi lấy số lượng tin nhắn chưa đọc' });
  }
};

exports.markAllAsSeen = async (req, res) => {
  const me = req.user.id;
  const { userId } = req.params;

  try {
    const { rows } = await pool.query(
      `UPDATE messages SET seen_at = NOW(), unread = false
       WHERE sender_id = $1 AND receiver_id = $2 AND unread = true
       RETURNING id`,
      [userId, me]
    );

    rows.forEach(r => {
      req.io.to(`user_${userId}`).emit('message:seen', { messageId: r.id });
    });

    res.json({ success: true, updatedCount: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi đánh dấu tất cả tin nhắn đã xem' });
  }
};
