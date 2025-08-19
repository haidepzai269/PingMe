const pool = require('../db');

// Tạo thông báo (dùng nội bộ hoặc cho API admin)
// Tạo thông báo (dùng nội bộ hoặc cho API admin)
exports.createNotification = async (userId, senderId, type, message, icon = null) => {
  const { rows } = await pool.query(
    `INSERT INTO notifications (user_id, sender_id, type, message, icon)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, senderId, type, message, icon]
  );
  return rows[0];
};


// Lấy danh sách thông báo của user
exports.getNotifications = async (req, res) => {
  const userId = req.user.id;
  const { rows } = await pool.query(
    `SELECT n.*, 
            u.username AS sender_name, u.avatar AS sender_avatar
     FROM notifications n
     LEFT JOIN users u ON n.sender_id = u.id
     WHERE n.user_id = $1
     ORDER BY n.created_at DESC`,
    [userId]
  );
  res.json(rows);
};

// Đánh dấu đã đọc
exports.markAsRead = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const { rowCount } = await pool.query(
    `UPDATE notifications SET is_read=TRUE 
     WHERE id=$1 AND user_id=$2`,
    [id, userId]
  );

  if (rowCount === 0) {
    return res.status(404).json({ message: 'Notification not found' });
  }
  res.json({ success: true });
};

// Xoá thông báo
exports.deleteNotification = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const { rowCount } = await pool.query(
    `DELETE FROM notifications WHERE id=$1 AND user_id=$2`,
    [id, userId]
  );

  if (rowCount === 0) {
    return res.status(404).json({ message: 'Notification not found' });
  }
  res.json({ success: true });
};

exports.markAsUnread = async (req, res) => {
    try {
      const { id } = req.params;
      const { rows } = await pool.query(
        'UPDATE notifications SET is_read = false WHERE id = $1 RETURNING *',
        [id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  };
  