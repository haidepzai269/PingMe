// backend/controllers/user.controller.js
const pool = require('../db');

// 📥 Lấy danh sách người dùng (trừ chính mình)
exports.getAllUsersExceptMe = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const result = await pool.query(
      'SELECT id, username, avatar FROM users WHERE id != $1 ORDER BY id DESC',
      [currentUserId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Lỗi lấy danh sách users:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};
