const express = require('express');
const multer = require('multer');
const { uploadZip } = require('../controllers/uploads.controller');

const router = express.Router();
const upload = multer({ dest: 'uploads/' })

router.post("/", upload.single('file'), uploadZip)

module.exports = router;