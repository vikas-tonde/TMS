import multer from "multer";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, process.env.FILE_UPLOAD_LOCATION)
    },
    filename: function (req, file, cb) {
      
      cb(null, file.originalname)
    }
  })
  
export const upload = multer({ 
    storage, 
})