const express = require('express');
const router = express.Router();
const {
  register,
  login,
  refreshToken,
  sendResetCode,
  resetPassword
} = require('../controllers/auth.controller');

// Đăng ký
router.post('/register', register);

// Đăng nhập
router.post('/login', login);

// Refresh token
router.post('/refresh', refreshToken);

// Gửi mã xác minh qua email (quên mật khẩu)
router.post('/send-reset-code', sendResetCode); // ✅ giữ nguyên như HTML đang gọi

// Đặt lại mật khẩu
router.post('/reset-password', resetPassword);

module.exports = router;
