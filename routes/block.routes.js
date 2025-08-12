const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const blockController = require('../controllers/block.controller');

router.post('/:userId', auth, blockController.blockUser);
router.delete('/:userId', auth, blockController.unblockUser);
router.get('/check/:userId', auth, blockController.checkBlockStatus);

module.exports = router;
