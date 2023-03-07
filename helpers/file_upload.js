/* eslint-disable no-unused-vars */
const { BlobServiceClient } = require("@azure/storage-blob");
const AZURE_CONNECTION_STRING = "DefaultEndpointsProtocol=https;AccountName=skrapeuploads;AccountKey=Myb7eIX8wtPB+RShI8h3GOCq3hBygHbRYNb17MB9czRZnQDw4EZ/sjehhcIlrPBBoonl+n98b++7+ASt+sMw1w==;EndpointSuffix=core.windows.net";
const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_CONNECTION_STRING);
const fs = require("fs").promises;

const uploadToAzure = async (file, containerName) => {
  console.log(file);
  try {
    // Create the container
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const containerExists = await containerClient.exists();
    if (!containerExists) {
      await containerClient.create({ access: "blob" });
    }
    // buffer the file
    const fileBuffer = await fs.readFile(file);
    // get the file name
    const fileName = file.split("/").pop();
    // Create the blob
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    console.log("Uploading to Azure storage as blob:", fileName);
    const uploadBlobResponse = await blockBlobClient.upload(fileBuffer, fileBuffer.length);
    // get the url of the uploaded file
    const url = await blockBlobClient.url;
    if (file) {
      await fs.unlink(file);
    }
    return { url };
  } catch (error) {
    console.log(error.message);
    return { error };
  }
};
module.exports = { uploadToAzure };
