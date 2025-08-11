const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const ctrl = require('../controllers/search.controller');

router.get('/', auth, ctrl.searchUsers);
router.get('/history', auth, ctrl.getSearchHistory);
router.post('/history', auth, ctrl.saveSearchHistory);
router.post('/history/delete', auth, ctrl.deleteSearchHistory);
router.get('/suggestions', auth, ctrl.getSearchSuggestions);

module.exports = router;
