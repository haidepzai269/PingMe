const pool = require('../db');

// Chặn người dùng
exports.blockUser = async (req, res) => {
  const blocker_id = req.user.id;
  const { userId } = req.params;

  try {
    await pool.query(
      `INSERT INTO blocked_users (blocker_id, blocked_id)
       VALUES ($1, $2)
       ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [blocker_id, userId]
    );

    res.json({ success: true, message: 'Đã chặn người dùng' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi chặn người dùng' });
  }
};

// Bỏ chặn
exports.unblockUser = async (req, res) => {
  const blocker_id = req.user.id;
  const { userId } = req.params;

  try {
    await pool.query(
      `DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2`,
      [blocker_id, userId]
    );
    res.json({ success: true, message: 'Đã bỏ chặn người dùng' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi bỏ chặn người dùng' });
  }
};

// Kiểm tra trạng thái chặn
exports.checkBlockStatus = async (req, res) => {
  const me = req.user.id;
  const { userId } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT * FROM blocked_users 
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1)`,
      [me, userId]
    );

    const iBlockedThem = rows.some(r => r.blocker_id == me && r.blocked_id == userId);
    const theyBlockedMe = rows.some(r => r.blocker_id == userId && r.blocked_id == me);

    res.json({ iBlockedThem, theyBlockedMe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi kiểm tra trạng thái chặn' });
  }
};
