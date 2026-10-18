import { PDFExtract } from "pdf.js-extract";
import fs from "fs";
import path from "path";

export const extractTextFromPdf = async (filePath) => {
    // Ensure filePath is absolute
    const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);

    const pdfExtract = new PDFExtract();
    const options = {};
    const extractedText = await new Promise((resolve, reject) => {
        pdfExtract.extract(absolutePath, options, (err, data) => {
            if (err) return reject(err);
            // Combine all text from all pages
            const text = data.pages.map(page =>
                page.content.map(item => item.str).join(" ")
            ).join("\n");
            resolve(text);
        });
    });
    fs.unlinkSync(absolutePath);
    return extractedText;
}