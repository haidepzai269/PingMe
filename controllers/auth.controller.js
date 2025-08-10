const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user.id }, // ✅ chỉ chứa id
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

exports.register = async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, hashedPassword]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'Tên tài khoản đã tồn tại' });
    }
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Sai tên tài khoản hoặc mật khẩu' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).json({ message: 'Sai tên tài khoản hoặc mật khẩu' });
    }

    const tokens = generateTokens(user);
    res.json(tokens);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.sendStatus(401);

  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, async (err, user) => {
    if (err) return res.sendStatus(403);

    // Lấy lại thông tin user từ DB
    const result = await pool.query('SELECT id, username FROM users WHERE id = $1', [user.id]);
    if (result.rows.length === 0) return res.sendStatus(404);

    const fullUser = result.rows[0];

    const accessToken = jwt.sign(
      { id: fullUser.id, username: fullUser.username }, // ✅ thêm username
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ accessToken });
  });
};

//
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  
  // Gửi mã xác minh
  exports.sendResetCode = async (req, res) => {
    const { email } = req.body;
    try {
      const userRes = await pool.query('SELECT * FROM users WHERE username=$1', [email]);
      if (userRes.rows.length === 0) {
        return res.status(404).json({ message: 'Email không tồn tại!' });
      }
  
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiration = new Date(Date.now() + 15 * 60 * 1000); // 15 phút
  
      await pool.query(
        'UPDATE users SET reset_code=$1, reset_code_expiration=$2 WHERE username=$3',
        [resetCode, expiration, email]
      );
  
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Mã xác minh đặt lại mật khẩu',
        text: `Mã xác minh của bạn là: ${resetCode}. Hết hạn sau 15 phút.`
      });
  
      res.json({ message: 'Mã xác minh đã được gửi!' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Lỗi khi gửi mã xác minh' });
    }
  };
  
  // Đặt lại mật khẩu
  exports.resetPassword = async (req, res) => {
    const { email, code, newPassword } = req.body;
    try {
      const userRes = await pool.query('SELECT * FROM users WHERE username=$1', [email]);
      if (userRes.rows.length === 0) {
        return res.status(404).json({ message: 'Email không tồn tại!' });
      }
  
      const user = userRes.rows[0];
      if (user.reset_code !== code) {
        return res.status(400).json({ message: 'Mã xác minh không đúng!' });
      }
  
      if (new Date() > new Date(user.reset_code_expiration)) {
        return res.status(400).json({ message: 'Mã xác minh đã hết hạn!' });
      }
  
      const hashed = await bcrypt.hash(newPassword, 10);
      await pool.query(
        'UPDATE users SET password=$1, reset_code=NULL, reset_code_expiration=NULL WHERE username=$2',
        [hashed, email]
      );
  
      res.json({ message: 'Đổi mật khẩu thành công!' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Lỗi khi đổi mật khẩu' });
    }
  };