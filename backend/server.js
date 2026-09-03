const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const pool = require("./config/db");
const supabase = require("./config/supabase");

const authRoutes = require("./routes/authRoutes");
const folderRoutes = require("./routes/folderRoutes");
const fileRoutes = require("./routes/fileRoutes");

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/folders", folderRoutes);
app.use("/api/files", fileRoutes);

app.get("/api", (req, res) => {
  res.json({
    message: "Cloud Storage Service API is running",
  });
});

app.get("/api/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      message: "Database connected successfully",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error("Database connection error:", error.message);

    res.status(500).json({
      message: "Database connection failed",
      error: error.message,
    });
  }
});


app.get("/api/storage-test", async (req, res) => {
  try {
    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
      throw error;
    }

    res.json({
      message: "Supabase Storage connected successfully",
      buckets: data.map((bucket) => bucket.name),
    });
  } catch (error) {
    console.error("Storage connection error:", error.message);

    res.status(500).json({
      message: "Supabase Storage connection failed",
      error: error.message,
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});