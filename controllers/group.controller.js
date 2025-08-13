// backend/controllers/groupController.js
const db = require('../db'); // module kết nối DB

exports.createGroup = async (req, res) => {
  try {
    const { name, members } = req.body;
    const ownerId = req.user.id;

    if (!name || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ message: 'Tên nhóm và thành viên là bắt buộc' });
    }

    // Tạo nhóm
    const result = await db.query(
      'INSERT INTO groups (name, owner_id) VALUES ($1, $2) RETURNING id',
      [name, ownerId]
    );
    const groupId = result.rows[0].id;

    // Thêm owner vào members nếu chưa có
    if (!members.includes(ownerId)) {
      members.push(ownerId);
    }

    // Lưu thành viên
    for (const userId of members) {
      await db.query(
        'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
        [groupId, userId]
      );
    }

    res.json({ success: true, groupId });
  } catch (err) {
    console.error('Lỗi tạo nhóm:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

exports.getMyGroups = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT g.id, g.name, g.owner_id, g.created_at
       FROM groups g
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = $1`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Lỗi lấy nhóm:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
};
