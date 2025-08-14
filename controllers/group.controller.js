// backend/controllers/groupController.js
const db = require('../db'); // module kết nối DB


exports.createGroup = async (req, res) => {
  try {
    const { name, members } = req.body;
    const ownerId = req.user.id;

    if (!name || !Array.isArray(members)) {
      return res.status(400).json({ message: 'Tên nhóm và thành viên là bắt buộc' });
    }

    let cleanMembers = members
      .filter(uid => Number.isInteger(uid) && uid > 0)
      .filter((uid, index, arr) => arr.indexOf(uid) === index);

    if (!cleanMembers.includes(ownerId)) {
      cleanMembers.push(ownerId);
    }

    const result = await db.query(
      'INSERT INTO groups (name, owner_id) VALUES ($1, $2) RETURNING id, name, owner_id, created_at',
      [name, ownerId]
    );
    const group = result.rows[0];

    for (const userId of cleanMembers) {
      await db.query(
        'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
        [group.id, userId]
      );
    }

    // Emit real-time
    const io = req.app.get('io');
    cleanMembers.forEach(uid => {
      io.to(`user_${uid}`).emit('group:new', group);
    });

    // Trả luôn object group cho người tạo
    res.json(group);
  } catch (err) {
    console.error('Lỗi tạo nhóm:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
};




exports.getMyGroups = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT g.id, g.name, g.owner_id, g.created_at,
              COUNT(gm2.user_id) AS members_count
       FROM groups g
       JOIN group_members gm ON g.id = gm.group_id
       JOIN group_members gm2 ON g.id = gm2.group_id
       WHERE gm.user_id = $1
       GROUP BY g.id, g.name, g.owner_id, g.created_at
       ORDER BY g.created_at DESC`,
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

    // Lấy tên user để hiển thị trong thông báo
    const userRes = await db.query(
      'SELECT username FROM users WHERE id = $1',
      [userId]
    );
    const username = userRes.rows[0]?.username || 'Người dùng';

    // Xóa thành viên khỏi nhóm
    await db.query(
      'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );

    // Emit tin nhắn hệ thống cho các thành viên nhóm
    const io = req.app.get('io');
    const systemMessage = {
      group_id: Number(groupId),
      type: 'system',
      content: `${username} đã rời nhóm`,
      created_at: new Date()
    };
    io.to(`group_${groupId}`).emit('group:system_message', systemMessage);

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

// gửi tin nhắn 
exports.sendGroupMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Nội dung không được để trống' });
    }

    // Kiểm tra user có thuộc nhóm không
    const check = await db.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    if (check.rowCount === 0) {
      return res.status(403).json({ message: 'Bạn không thuộc nhóm này' });
    }

    // Lưu DB
    const insert = await db.query(
      `INSERT INTO group_messages (group_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, group_id, sender_id, content, created_at`,
      [groupId, userId, content.trim()]
    );
    const saved = insert.rows[0];

    // Lấy info người gửi để render giống getGroupMessages
    const userQ = await db.query(
      'SELECT username, avatar FROM users WHERE id = $1',
      [userId]
    );
    const { username, avatar } = userQ.rows[0] || {};

    const payload = {
      id: saved.id,
      group_id: Number(groupId),
      sender_id: userId,
      content: saved.content,
      created_at: saved.created_at,
      username,
      avatar
    };

    // Emit realtime vào room group
    const io = req.app.get('io');
    io.to(`group_${groupId}`).emit('group:message', payload);

    res.json(payload);
  } catch (err) {
    console.error('Lỗi gửi tin nhắn nhóm:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
};