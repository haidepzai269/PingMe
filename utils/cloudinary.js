// backend/utils/cloudinary.js
const cloudinary = require('cloudinary').v2;

// Cấu hình từ biến môi trường .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload buffer ảnh lên Cloudinary
 * @param {Buffer} buffer - Ảnh dạng buffer
 * @param {String} folder - Tên folder trên Cloudinary
 */
exports.uploadToCloudinary = (buffer, folder = 'avatars') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image'
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
};
