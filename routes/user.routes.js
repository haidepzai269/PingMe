// backend/routes/user.routes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const userController = require('../controllers/user.controller');

// GET /api/users
router.get('/', authMiddleware, userController.getAllUsersExceptMe);

module.exports = router;
