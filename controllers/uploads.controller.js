const { zipFiles, unzipFiles } = require('../services/zip.service');
const fs = require('fs');

const uploadZip = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send({ message: "No file uploaded. Please ensure the field name is 'file'." });
        }

        await unzipFiles(req.file.path, './unzip/')
        await zipFiles('./unzip/', './upload.zip')
        fs.rmSync('./uploads', { recursive: true, force: true })
        fs.rmSync('./unzip', { recursive: true, force: true })
        res.status(200).send({
            message: "File uploaded successfully"
        })
    } catch (error) {
        console.error(error)
        res.status(500).send({ message: error.message })
    }
}

module.exports = { uploadZip }