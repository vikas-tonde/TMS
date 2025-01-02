import multer from "multer";
import path from 'path';

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
    let sanitizedFilename = file.originalname.replace(/\s+/g, '_');
    sanitizedFilename = sanitizedFilename.replace(/[^\w.-]+/g, '');

    const ext = path.extname(sanitizedFilename);
    if (!ext) {
      sanitizedFilename = sanitizedFilename + path.extname(file.originalname);
    }
    cb(null, sanitizedFilename)
  }
})

const upload = multer({
  storage,
});
const imageUpload = multer({
  storage: imageStorage,
});
export { imageUpload, upload };

