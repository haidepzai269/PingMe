// routes/calls.routes.js
const express = require('express');
const { getCalls } = require('../controllers/calls.controller');
const router = express.Router();

// Lấy lịch sử cuộc gọi giữa 2 user
router.get('/', getCalls);

module.exports = router;
