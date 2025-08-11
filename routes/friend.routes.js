// backend/routes/friend.routes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const friendController = require('../controllers/friend.controller');

router.post('/request', authMiddleware, friendController.sendFriendRequest);
router.get('/requests', authMiddleware, friendController.getReceivedRequests);
router.post('/accept/:requestId', authMiddleware, friendController.acceptRequest);
router.delete('/decline/:requestId', authMiddleware, friendController.declineRequest);
router.delete('/unfriend/:friendId', authMiddleware, friendController.unfriend);
router.get('/status/:userId', authMiddleware, friendController.getFriendStatus);
router.get('/', authMiddleware, friendController.getFriends);
module.exports = router;
