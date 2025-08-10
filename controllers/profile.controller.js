const pool = require('../db');

exports.getMe = async (req, res) => {
    try {
      const userId = req.user.id;
  
      // Lấy thông tin user
      const result = await pool.query(
        'SELECT id, username, avatar, bio FROM users WHERE id = $1',
        [userId]
      );
  
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'User không tồn tại' });
      }
  
      // Đếm số bạn bè
      const countResult = await pool.query(
        `SELECT COUNT(*) AS count
         FROM friends
         WHERE user1_id = $1 OR user2_id = $1`,
        [userId]
      );
  
      const profile = {
        ...result.rows[0],
        friends_count: parseInt(countResult.rows[0].count, 10)
      };
  
      res.json(profile);
    } catch (error) {
      console.error('Lỗi getMe:', error);
      res.status(500).json({ message: 'Lỗi server' });
    }
  };
  
  exports.updateMe = async (req, res) => {
    try {
      const userId = req.user.id;
      let { username, bio } = req.body;
      let avatarUrl;
  
      if (req.file) {
        const uploaded = await uploadToCloudinary(req.file.buffer);
        avatarUrl = uploaded.secure_url;
      }
  
      // Lấy thông tin cũ
      const oldUser = await pool.query(
        'SELECT username, bio, avatar FROM users WHERE id = $1',
        [userId]
      );
      if (oldUser.rows.length === 0) {
        return res.status(404).json({ message: 'User không tồn tại' });
      }
  
      username = username || oldUser.rows[0].username;
      bio = bio || oldUser.rows[0].bio;
      avatarUrl = avatarUrl || oldUser.rows[0].avatar;
  
      await pool.query(
        'UPDATE users SET username = $1, bio = $2, avatar = $3 WHERE id = $4',
        [username, bio, avatarUrl, userId]
      );
  
      // Đếm lại số bạn bè sau khi update
      const countResult = await pool.query(
        `SELECT COUNT(*) AS count
         FROM friends
         WHERE user1_id = $1 OR user2_id = $1`,
        [userId]
      );
  
      res.json({
        id: userId,
        username,
        bio,
        avatar: avatarUrl,
        friends_count: parseInt(countResult.rows[0].count, 10)
      });
    } catch (error) {
      console.error('Lỗi updateMe:', error);
      res.status(500).json({ message: 'Lỗi server' });
    }
  };
  