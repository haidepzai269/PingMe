// utils/weather.js
const axios = require('axios');

async function fetchWeather() {
  try {
    const apiKey = process.env.WEATHER_API_KEY;
    const city = 'Hanoi';
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}&lang=vi`;

    const { data } = await axios.get(url);

    return {
      description: data.weather[0].description,
      temp: data.main.temp,
      icon: data.weather[0].icon // ví dụ: "10d"
    };
  } catch (err) {
    console.error('Lỗi fetchWeather:', err.message);
    return null;
  }
}

module.exports = fetchWeather;
