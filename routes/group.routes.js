// backend/routes/groupRoutes.js
const express = require('express');
const router = express.Router();
const groupController = require('../controllers/group.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.post('/', authMiddleware, groupController.createGroup);
router.get('/my', authMiddleware, groupController.getMyGroups);

module.exports = router;
