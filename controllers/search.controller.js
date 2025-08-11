// backend/controllers/search.controller.js
const pool = require('../db');
const { Client } = require('@elastic/elasticsearch');
const esClient = new Client({ node: process.env.ELASTIC_URL || 'http://localhost:9200' });

const ES_INDEX = 'users_index';

// --- Tìm kiếm người dùng ---
exports.searchUsers = async (req, res) => {
  const q = req.query.q?.trim();
  console.log('Search query:', q);
  if (!q) return res.json([]);

  try {
    const result = await esClient.search({
      index: ES_INDEX,
      query: {
        multi_match: {
          query: q,
          fields: ['username^2', 'bio'],
          fuzziness: 'AUTO'
        }
      }
    });

    console.log('ES search result:', JSON.stringify(result, null, 2));

    if (!result.hits) {
      return res.json([]);
    }

    const hits = result.hits.hits.map(h => ({
      id: h._source.id,
      username: h._source.username,
      avatar: h._source.avatar,
      bio: h._source.bio
    }));

    res.json(hits);
  } catch (err) {
    console.error('ES search error:', err);
    res.status(500).json({ message: 'Search error' });
  }
};



// --- Lấy lịch sử tìm kiếm ---
exports.getSearchHistory = async (req, res) => {
  console.log('User ID trong getSearchHistory:', req.user?.id);
  try {
    const result = await pool.query(
      `SELECT keyword FROM search_history 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'DB error' });
  }
};

// --- Lưu lịch sử tìm kiếm ---
exports.saveSearchHistory = async (req, res) => {
  const { keyword } = req.body;
  console.log('Lưu lịch sử từ khóa:', keyword, 'user_id:', req.user?.id);
  if (!keyword) return res.status(400).json({ message: 'Missing keyword' });

  try {
    await pool.query(
      'INSERT INTO search_history (user_id, keyword) VALUES ($1, $2)',
      [req.user.id, keyword]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'DB error' });
  }
};

// --- Xóa lịch sử ---
exports.deleteSearchHistory = async (req, res) => {
  const { keyword, clearAll } = req.body;

  try {
    if (clearAll) {
      await pool.query('DELETE FROM search_history WHERE user_id = $1', [req.user.id]);
    } else if (keyword) {
      await pool.query(
        'DELETE FROM search_history WHERE user_id = $1 AND keyword = $2',
        [req.user.id, keyword]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'DB error' });
  }
};

// --- Gợi ý tìm kiếm (top từ khóa tìm nhiều nhất) ---
exports.getSearchSuggestions = async (req, res) => {
  const q = req.query.q?.trim();
  try {
    let query = `
      SELECT keyword, COUNT(*) AS count
      FROM search_history
    `;
    const params = [];

    if (q) {
      query += ` WHERE keyword ILIKE $1`;
      params.push(`%${q}%`);
    }

    query += ` GROUP BY keyword ORDER BY count DESC LIMIT 10`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'DB error' });
  }
};
