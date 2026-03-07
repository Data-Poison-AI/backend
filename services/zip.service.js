const admZip = require("adm-zip");

const zipFiles = async (sourceDir, outputFilePath) => {
    const zip = new admZip();
    zip.addLocalFolder(sourceDir);
    await zip.writeZipPromise(outputFilePath);

    return `Zip file created: ${outputFilePath}`;
};

const unzipFiles = async (inputFilePath, outputDirectory) => {
    const zip = new admZip(inputFilePath);

    return new Promise((resolve, reject) => {
        zip.extractAllToAsync(outputDirectory, true, (error) => {
            if (error) return reject(error);
            resolve(`Extracted to "${outputDirectory}" successfully`);
        });
    });
};

module.exports = { zipFiles, unzipFiles };