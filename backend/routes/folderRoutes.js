const express = require("express");

const authenticateUser = require("../middleware/authMiddleware");
const { 
    createFolder,
    getFolders,
    updateFolder,
    deleteFolder,
} = require("../controllers/folderController");

const router = express.Router();

router.post("/", authenticateUser, createFolder);
router.get("/", authenticateUser, getFolders);
router.patch("/:id", authenticateUser, updateFolder);
router.delete("/:id", authenticateUser, deleteFolder);

module.exports = router;
