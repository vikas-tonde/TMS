import multer from "multer";
import path from 'path';
import fs from 'fs';
import logger from "../../utils/logger.js";

const MAX_FILE_SIZE = 1 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, process.env.FILE_UPLOAD_LOCATION)
  },
  filename: function (req, file, cb) {

    cb(null, file.originalname)
  }
})

const imageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, process.env.IMAGE_UPLOAD_LOCATION)
  },
  filename: function (req, file, cb) {
    const employeeId = req.user.employeeId;
    let sanitizedFilename = `${employeeId}${path.extname(file.originalname)}`;

    const filePath = path.join(process.env.IMAGE_UPLOAD_LOCATION, sanitizedFilename);

    // Check if the file already exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (!err) {
        // If file exists, delete it first
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) {
            logger.error('Error deleting the old file:', unlinkErr);
          }
        });
      }

      // Pass the sanitized filename to the callback to save the file
      cb(null, sanitizedFilename);
    });
  }
});

function handleImageUploadError(err, req, res, next) {
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File is too large. Max file size is 5MB.' });
    }
    logger.error('File upload error:', err);
    return res.status(500).json({ error: 'An error occurred during file upload.' });
  }

  next();
}

const upload = multer({
  storage,
});

const imageUpload = multer({
  storage: imageStorage,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});
export { imageUpload, upload, handleImageUploadError };

