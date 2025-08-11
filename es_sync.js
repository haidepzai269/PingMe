require('dotenv').config();  // load .env trong cùng thư mục
console.log('DATABASE_URL:', process.env.DATABASE_URL);

const pool = require('./db');
const { Client } = require('@elastic/elasticsearch');

const client = new Client({ node: process.env.ELASTIC_URL || 'http://localhost:9200' });

const ES_INDEX = 'users_index';

async function sync() {
  try {
    // Tạo index (bỏ qua lỗi nếu đã có)
    await client.indices.create({
      index: ES_INDEX,
      body: {
        settings: {
          analysis: {
            analyzer: {
              vi_analyzer: {
                tokenizer: 'standard',
                filter: [
                  'lowercase',
                  'asciifolding'  // chuyển dấu thành không dấu
                ]
              }
            }
          }
        },
        mappings: {
          properties: {
            id: { type: 'integer' },
            username: { type: 'text', analyzer: 'vi_analyzer' },
            bio: { type: 'text', analyzer: 'vi_analyzer' },
            avatar: { type: 'keyword' }
          }
        }
      }
    }, { ignore: [400] });
    

    // Lấy dữ liệu từ PostgreSQL
    const { rows } = await pool.query('SELECT id, username, bio, avatar FROM users');

    // Dùng Bulk API để index nhanh
    if (rows.length > 0) {
      const body = rows.flatMap(doc => [
        { index: { _index: ES_INDEX, _id: doc.id } },
        doc
      ]);
      await client.bulk({ refresh: true, body });
    }

    console.log('✅ Synced to Elasticsearch');
  } catch (err) {
    console.error('❌ Error syncing to Elasticsearch:', err);
  }
}

sync();
