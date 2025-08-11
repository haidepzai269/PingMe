// backend/routes/profile.routes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const profileController = require('../controllers/profile.controller');
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get('/me', authMiddleware, profileController.getMe);
router.put('/me', authMiddleware, upload.single('avatar'), profileController.updateMe);
router.get('/:id', authMiddleware, profileController.getUserById);


module.exports = router;
