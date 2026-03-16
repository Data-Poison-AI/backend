const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { zipFiles, unzipFiles } = require('../services/zip.service');

// Helper to run python script
const runPythonScript = (scriptPath, args) => {
    return new Promise((resolve, reject) => {
        console.log(`[AI-Process] Running: python ${scriptPath} ${args.join(' ')}`);

        // Execute python script with working dir as 'ai' folder
        const pyProg = spawn('python', [scriptPath, ...args], {
            cwd: path.resolve(__dirname, '../../ai') // __dirname is backend/controllers, so ../../ai points to the root 'ai' folder
        });

        // Capture stdout
        pyProg.stdout.on('data', (data) => {
            console.log(`[AI-Process stdout]: ${data.toString().trim()}`);
        });

        // Capture stderr
        pyProg.stderr.on('data', (data) => {
            console.error(`[AI-Process stderr]: ${data.toString().trim()}`);
        });

        pyProg.on('close', (code) => {
            if (code === 0) {
                console.log(`[AI-Process] Completed successfully.`);
                resolve();
            } else {
                reject(new Error(`AI Process failed with code: ${code}`));
            }
        });
    });
};

const uploadZip = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send({ message: "No file uploaded. Please ensure the field name is 'file'." });
        }

        // 1. Unzip uploaded file into a temporary unique directory
        const extractTimestamp = Date.now();
        const extractPath = path.resolve(__dirname, `../uploads/unzip_${extractTimestamp}`);

        if (!fs.existsSync(extractPath)) {
            fs.mkdirSync(extractPath, { recursive: true });
        }

        await unzipFiles(req.file.path, extractPath);

        // Remove the original uploaded .zip file immediately to save space
        if (fs.existsSync(req.file.path)) {
            fs.rmSync(req.file.path, { force: true });
        }

        // 2. Read the extracted directory and find datasets recursively
        const getAllFiles = (dir, fileList = []) => {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                if (fs.statSync(filePath).isDirectory()) {
                    getAllFiles(filePath, fileList);
                } else {
                    fileList.push(filePath);
                }
            }
            return fileList;
        };

        const extractedFiles = getAllFiles(extractPath);
        const dataFiles = extractedFiles.filter(f =>
            f.endsWith('.csv') || f.endsWith('.json') || f.endsWith('.parquet') || f.endsWith('.jsonl')
        );

        if (dataFiles.length === 0) {
            // Cleanup and exit if no files were found
            fs.rmSync(extractPath, { recursive: true, force: true });
            return res.status(400).send({ message: "No valid dataset files found (.csv, .json, .parquet) inside the ZIP." });
        }

        console.log(`Found ${dataFiles.length} dataset files to process.`);

        // 3. Prepare AI execution mapping
        const aiScriptPath = path.resolve(__dirname, '../../ai/main.py');
        const downloadsDir = path.resolve(__dirname, '../downloads');

        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
        }

        // Taking Snapshot of 'downloads' folder before AI execution
        const beforeReports = new Set(fs.readdirSync(downloadsDir));

        // Options sent by Frontend, or default values if none are sent
        // (Assuming frontend may eventually send these alongside the file in formData)
        const textCol = req.body.text_column || 'sample';
        const labelCol = req.body.label_column || 'emotion';

        // 4. Run the AI script over each extracted file ONE BY ONE 
        // We do this sequentially so that memory and GPU VRAM footprint doesn't explode.
        for (const dataFilePath of dataFiles) {
            try {
                await runPythonScript(aiScriptPath, [
                    '--data', dataFilePath,
                    '--task', 'text-classification',
                    '--text-column', textCol,
                    '--label-column', labelCol
                ]);
            } catch (pyErr) {
                console.error(`Error processing file ${dataFilePath}:`, pyErr);
                // Log the error but continue running the next dataset
            }
        }

        // Cleanup temporary extracted files folder
        fs.rmSync(extractPath, { recursive: true, force: true });

        // 5. Zip the AI output directory and send it
        const aiOutputDir = path.resolve(__dirname, '../../ai/poison_ai_output');
        
        if (!fs.existsSync(aiOutputDir)) {
            return res.status(500).send({ message: "The AI process finished, but the output folder was not found." });
        }

        // Output Zip (downloadsDir was already defined above)
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
        }
        
        const timestamp = Date.now();
        const outputZipPath = path.resolve(downloadsDir, `poison_ai_reports_${timestamp}.zip`);

        // Compress the poison_ai_output folder
        await zipFiles(aiOutputDir, outputZipPath);

        // 6. Return the Generated Reports back to the frontend
        res.download(outputZipPath, 'poison_ai_reports.zip', (err) => {
            if (err) console.error("Error sending file:", err);

            // Cleanup generated AI files after sending zip
            if (fs.existsSync(outputZipPath)) {
                fs.rmSync(outputZipPath, { force: true });
            }
            if (fs.existsSync(aiOutputDir)) {
                fs.rmSync(aiOutputDir, { recursive: true, force: true });
            }
        });

    } catch (error) {
        console.error("Critical Error in uploadZip:", error);
        if (!res.headersSent) {
            res.status(500).send({ message: error.message || "Internal server error during analysis." });
        }
    }
};

module.exports = { uploadZip };