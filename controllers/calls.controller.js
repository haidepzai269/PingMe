// controllers/calls.controller.js
const pool = require('../db');

// GET /api/calls?userId=...&chatWithUserId=...
exports.getCalls = async (req, res) => {
  try {
    const { userId, chatWithUserId } = req.query;
    if (!userId || !chatWithUserId) {
      return res.status(400).json({ success: false, message: 'Missing userId or chatWithUserId' });
    }

    const { rows } = await pool.query(
      `SELECT c.*, 
              u1.username AS caller_name, u1.avatar AS caller_avatar,
              u2.username AS callee_name, u2.avatar AS callee_avatar
       FROM calls c
       JOIN users u1 ON c.caller_id = u1.id
       JOIN users u2 ON c.callee_id = u2.id
       WHERE ((caller_id=$1 AND callee_id=$2) 
           OR (caller_id=$2 AND callee_id=$1))
         AND c.status != 'ringing'
       ORDER BY c.started_at ASC`,
      [userId, chatWithUserId]
    );

    // 🚀 Gắn thêm type: nếu rtc_room_id bắt đầu bằng 'video-' thì coi là video, ngược lại voice
    const calls = rows.map(c => ({
      ...c,
      type: c.rtc_room_id && c.rtc_room_id.startsWith('video-') ? 'video' : 'voice'
    }));

    res.json({ success: true, calls });
  } catch (err) {
    console.error('getCalls error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
