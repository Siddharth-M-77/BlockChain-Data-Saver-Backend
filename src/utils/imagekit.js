import ImageKit from "imagekit";
import fs from "fs";

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

export const uploadToImageKit = async (file, folderName = "GLC_CRYPTO") => {
  try {
    let base64Data;

    // ✅ Case 1: file.buffer exists (memoryStorage)
    if (file.buffer) {
      base64Data = file.buffer.toString("base64");
    }
    // ✅ Case 2: file.path exists (diskStorage)
    else if (file.path) {
      const fileData = fs.readFileSync(file.path);
      base64Data = fileData.toString("base64");
    } else {
      throw new Error("Invalid file input. File buffer/path not found.");
    }

    // ✅ Upload to ImageKit
    const result = await imagekit.upload({
      file: `data:${file.mimetype};base64,${base64Data}`,
      fileName: `${Date.now()}-${file.originalname}`,
      folder: `/${folderName}`,
      useUniqueFileName: true,
    });

    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
      console.log(`🗑️ Deleted local file: ${file.path}`);
    }

    // ✅ Return uploaded URL + fileId (useful for deletion later)
    return {
      url: result.url,
      fileId: result.fileId,
    };
  } catch (error) {
    console.error("❌ ImageKit Upload Error:", error);
    // Delete local file if upload failed
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
      console.log(`🗑️ Deleted local file after failed upload: ${file.path}`);
    }
    return null;
  }
};

export const deleteFromImageKit = async (fileId) => {
  try {
    await imagekit.deleteFile(fileId);
    console.log(`🗑️ Deleted from ImageKit: ${fileId}`);
    return true;
  } catch (error) {
    console.error("❌ Failed to delete from ImageKit:", error);
    return false;
  }
};
