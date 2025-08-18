const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const notifController = require('../controllers/notification.controller');

router.get('/', authMiddleware, notifController.getNotifications);
router.patch('/:id/read', authMiddleware, notifController.markAsRead);
router.delete('/:id', authMiddleware, notifController.deleteNotification);
router.patch('/:id/unread', authMiddleware, notifController.markAsUnread);

module.exports = router;
