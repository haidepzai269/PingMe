// backend/routes/groupRoutes.js
const express = require('express');
const router = express.Router();
const groupController = require('../controllers/group.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.post('/', authMiddleware, groupController.createGroup);
router.get('/my', authMiddleware, groupController.getMyGroups);
router.delete('/:groupId/leave', authMiddleware, groupController.leaveGroup);
router.get('/:groupId/messages', authMiddleware, groupController.getGroupMessages);

module.exports = router;
