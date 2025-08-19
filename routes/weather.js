// routes/weather.js
const express = require('express');
const router = express.Router();
const fetchWeather = require('../utils/weather');

router.get('/today', async (req, res) => {
  const todayWeather = await fetchWeather();
  if (!todayWeather) return res.status(500).json({ error: 'Không lấy được thời tiết' });
  res.json(todayWeather);
});

module.exports = router;
