// backend/middleware/auth.middleware.js
const pool = require('../db');
const jwt = require('jsonwebtoken');

module.exports = async function (req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Không có token' });

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        // Token hết hạn => 401 để frontend gọi refresh
        return res.status(401).json({ message: 'Token hết hạn' });
      }
      // Token giả mạo hoặc sai
      return res.status(403).json({ message: 'Token không hợp lệ' });
    }
  
    // Token hợp lệ => lấy user
    try {
      const result = await pool.query(
        'SELECT id, username, avatar, bio, friends_count FROM users WHERE id = $1',
        [decoded.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'User không tồn tại' });
      }
      req.user = result.rows[0];
      next();
    } catch (dbErr) {
      console.error(dbErr);
      res.status(500).json({ message: 'Lỗi server' });
    }
  });
  
};
