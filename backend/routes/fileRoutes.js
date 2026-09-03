const express = require("express");
const multer = require("multer");

const authenticateUser = require("../middleware/authMiddleware");
const {
  uploadFile,
  getFiles,
  downloadFile,
  deleteFile,
  getTrashFiles,
  restoreFile,
  permanentDeleteFile,
} = require("../controllers/fileController");

const router = express.Router();

// Store uploaded files temporarily in memory
const upload = multer({
  storage: multer.memoryStorage(),
});

// Upload a single file
router.post(
  "/upload",
  authenticateUser,
  upload.single("file"),
  uploadFile
);

router.get("/", authenticateUser, getFiles);

router.get("/trash", authenticateUser, getTrashFiles);

router.patch("/:id/restore", authenticateUser, restoreFile);

router.get("/:id/download", authenticateUser, downloadFile);

router.delete(
    "/:id/permanent",
    authenticateUser,
    permanentDeleteFile
);

router.delete("/:id", authenticateUser, deleteFile);


module.exports = router;