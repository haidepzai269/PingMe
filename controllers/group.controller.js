// backend/controllers/groupController.js
const db = require('../db'); // module kết nối DB


exports.createGroup = async (req, res) => {
  try {
    const { name, members } = req.body;
    const ownerId = req.user.id;

    if (!name || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ message: 'Tên nhóm và thành viên là bắt buộc' });
    }

    const result = await db.query(
      'INSERT INTO groups (name, owner_id) VALUES ($1, $2) RETURNING id, name',
      [name, ownerId]
    );
    const groupId = result.rows[0].id;
    const groupName = result.rows[0].name;

    if (!members.includes(ownerId)) {
      members.push(ownerId);
    }

    for (const userId of members) {
      await db.query(
        'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
        [groupId, userId]
      );
    }

    // === Emit sự kiện cho các thành viên khác ===
    // === Emit sự kiện cho tất cả thành viên (kể cả owner) ===
  const io = req.app.get('io');
  members.forEach(uid => {
    io.to(`user_${uid}`).emit('group:new', {
      id: groupId,
      name: groupName,
      owner_id: ownerId
    });
  });


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

exports.leaveGroup = async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;

    // Xóa thành viên khỏi nhóm
    await db.query(
      'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Lỗi thoát nhóm:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Lấy tin nhắn nhóm
exports.getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    // Kiểm tra user có trong nhóm không
    const check = await db.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    if (check.rowCount === 0) {
      return res.status(403).json({ message: 'Bạn không thuộc nhóm này' });
    }

    const messages = await db.query(
      `SELECT gm.id, gm.content, gm.created_at, u.username, u.avatar, gm.sender_id
       FROM group_messages gm
       JOIN users u ON gm.sender_id = u.id
       WHERE gm.group_id = $1
       ORDER BY gm.created_at ASC`,
      [groupId]
    );

    res.json(messages.rows);
  } catch (err) {
    console.error('Lỗi lấy tin nhắn nhóm:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
};
