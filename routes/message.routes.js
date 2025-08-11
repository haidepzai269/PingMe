// backend/routes/message.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const messageController = require('../controllers/message.controller');

router.post('/', auth, messageController.multerUpload, messageController.sendMessage);
router.get('/:userId', auth, messageController.getMessages);
router.put('/:messageId/seen', auth, messageController.markAsSeen);
router.get('/recent', auth, messageController.getRecentChats);
router.delete('/:messageId', auth, messageController.deleteMessage);

module.exports = router;
