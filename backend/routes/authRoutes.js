const express = require("express");
const authenticateUser = require("../middleware/authMiddleware");
const { createOrGetUser } = require("../services/userService");

const router = express.Router();

router.get("/me", authenticateUser, async (req, res) => {
  try {
    const user = await createOrGetUser(req.user);

    res.json({
      message: "Authenticated user",
      user,
    });
  } catch (error) {
    console.error("User sync error:", error.message);

    res.status(500).json({
      message: "Failed to synchronize user",
    });
  }
});

module.exports = router;