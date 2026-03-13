const { zipFiles, unzipFiles } = require('../services/zip.service');
const fs = require('fs');

const uploadZip = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send({ message: "No file uploaded. Please ensure the field name is 'file'." });
        }

        await unzipFiles(req.file.path, './unzip/')
        await zipFiles('./unzip/', './upload.zip')
        // Cleanup exactly what we extracted, but DON'T delete the main 'uploads' folder!
        fs.rmSync(req.file.path, { force: true });
        
        if (fs.existsSync('./unzip')) {
            fs.rmSync('./unzip', { recursive: true, force: true });
        }

        res.download('./upload.zip', 'report_analisis.zip', (err) => {
            if (err) {
                console.error("Error al enviar archivo:", err);
                if (!res.headersSent) {
                    res.status(500).send({ message: "Error enviando el archivo" });
                }
            }
            // Cleanup the generated zip after sending
            if (fs.existsSync('./upload.zip')) {
                fs.rmSync('./upload.zip', { force: true });
            }
        });
    } catch (error) {
        console.error(error);
        if (!res.headersSent) {
            res.status(500).send({ message: error.message });
        }
    }
}

module.exports = { uploadZip }