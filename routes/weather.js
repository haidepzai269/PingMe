// routes/weather.js
const express = require('express');
const router = express.Router();

router.get('/today', (req, res) => {
  const todayWeather = {
    summary: "Nắng đẹp, có mây nhẹ",
    temp: 31,
  };
  res.json(todayWeather);
});

module.exports = router;
