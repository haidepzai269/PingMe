const pool = require('../db');
const cloudinary = require('cloudinary').v2;

// Config Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'avatars' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
};

// ================== Lấy thông tin bản thân ==================
exports.getMe = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT id, username, avatar, bio, email, gender, address, phone
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User không tồn tại' });
    }

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

// ================== Cập nhật bản thân ==================
exports.updateMe = async (req, res) => {
  try {
    const userId = req.user.id;
    let { username, bio, email, gender, address, phone } = req.body;
    let avatarUrl;

    if (req.file) {
      const uploaded = await uploadToCloudinary(req.file.buffer);
      avatarUrl = uploaded.secure_url;
    }

    const oldUser = await pool.query(
      `SELECT username, bio, avatar, email, gender, address, phone
       FROM users WHERE id = $1`,
      [userId]
    );
    if (oldUser.rows.length === 0) {
      return res.status(404).json({ message: 'User không tồn tại' });
    }

    username = username || oldUser.rows[0].username;
    bio = bio || oldUser.rows[0].bio;
    avatarUrl = avatarUrl || oldUser.rows[0].avatar;
    email = email || oldUser.rows[0].email;
    gender = gender || oldUser.rows[0].gender;
    address = address || oldUser.rows[0].address;
    phone = phone || oldUser.rows[0].phone;

    await pool.query(
      `UPDATE users
       SET username=$1, bio=$2, avatar=$3, email=$4, gender=$5, address=$6, phone=$7
       WHERE id=$8`,
      [username, bio, avatarUrl, email, gender, address, phone, userId]
    );

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
      email,
      gender,
      address,
      phone,
      friends_count: parseInt(countResult.rows[0].count, 10)
    });
  } catch (error) {
    console.error('Lỗi updateMe:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// ================== Lấy thông tin user khác ==================
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, username, avatar, bio, email, gender, address, phone
       FROM users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User không tồn tại' });
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) AS count
       FROM friends
       WHERE user1_id = $1 OR user2_id = $1`,
      [id]
    );

    const profile = {
      ...result.rows[0],
      friends_count: parseInt(countResult.rows[0].count, 10)
    };

    res.json(profile);
  } catch (error) {
    console.error('Lỗi getUserById:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};
