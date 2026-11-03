import multer from "multer"
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/temp')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})

export const upload = multer({ storage: storage })

const imageStorage = multer.memoryStorage()

export const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, and WebP images are supported"))
    }
    cb(null, true)
  },
})
