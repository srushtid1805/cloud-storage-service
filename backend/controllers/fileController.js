const pool = require("../config/db");
const supabase = require("../config/supabase");

const uploadFile = async (req, res) => {
  try {
    const ownerId = req.user.id;

    // Check whether a file was actually uploaded
    if (!req.file) {
      return res.status(400).json({
        message: "File is required",
      });
    }

    const file = req.file;

    // Optional folder ID
    const folderId = req.body.folder_id || null;

    // If folder_id is provided, make sure it belongs to the logged-in user
    if (folderId) {
      const folderResult = await pool.query(
        `SELECT id
         FROM folders
         WHERE id = $1
           AND owner_id = $2
           AND is_deleted = false`,
        [folderId, ownerId]
      );

      if (folderResult.rows.length === 0) {
        return res.status(404).json({
          message: "Folder not found",
        });
      }
    }

    // Create a unique storage path
    const storageKey = `${ownerId}/${folderId || "root"}/${Date.now()}-${file.originalname}`;

    // Upload file to Supabase Storage
    const { error: storageError } = await supabase.storage
      .from("drive")
      .upload(storageKey, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (storageError) {
      console.error("Storage upload error:", storageError.message);

      return res.status(500).json({
        message: "Failed to upload file to storage",
      });
    }

    // Save file metadata in PostgreSQL
    const result = await pool.query(
      `INSERT INTO files
       (
         name,
         mime_type,
         size_bytes,
         storage_key,
         owner_id,
         folder_id,
         checksum
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING
         id,
         name,
         mime_type,
         size_bytes,
         storage_key,
         owner_id,
         folder_id,
         checksum,
         is_deleted,
         created_at,
         updated_at`,
      [
        file.originalname,
        file.mimetype,
        file.size,
        storageKey,
        ownerId,
        folderId,
        null,
      ]
    );

    return res.status(201).json({
      message: "File uploaded successfully",
      file: result.rows[0],
    });
  } catch (error) {
    console.error("Upload file error:", error.message);

    return res.status(500).json({
      message: "Failed to upload file",
    });
  }
};

const getFiles = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { folder_id } = req.query;

    let result;

    if (folder_id) {
      // Verify that the folder belongs to the logged-in user
      const folderResult = await pool.query(
        `SELECT id
         FROM folders
         WHERE id = $1
           AND owner_id = $2
           AND is_deleted = false`,
        [folder_id, ownerId]
      );

      if (folderResult.rows.length === 0) {
        return res.status(404).json({
          message: "Folder not found",
        });
      }

      // Get files inside the requested folder
      result = await pool.query(
        `SELECT
           id,
           name,
           mime_type,
           size_bytes,
           storage_key,
           owner_id,
           folder_id,
           checksum,
           is_deleted,
           created_at,
           updated_at
         FROM files
         WHERE owner_id = $1
           AND folder_id = $2
           AND is_deleted = false
         ORDER BY created_at DESC`,
        [ownerId, folder_id]
      );
    } else {
      // Get files from the user's root
      result = await pool.query(
        `SELECT
           id,
           name,
           mime_type,
           size_bytes,
           storage_key,
           owner_id,
           folder_id,
           checksum,
           is_deleted,
           created_at,
           updated_at
         FROM files
         WHERE owner_id = $1
           AND folder_id IS NULL
           AND is_deleted = false
         ORDER BY created_at DESC`,
        [ownerId]
      );
    }

    return res.status(200).json({
      message: "Files fetched successfully",
      files: result.rows,
    });
  } catch (error) {
    console.error("Get files error:", error.message);

    return res.status(500).json({
      message: "Failed to fetch files",
    });
  }
};

const downloadFile = async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.user.id;

    // Find the file and verify ownership
    const result = await pool.query(
      `SELECT
         id,
         name,
         mime_type,
         storage_key,
         is_deleted
       FROM files
       WHERE id = $1
         AND owner_id = $2
         AND is_deleted = false`,
      [id, ownerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "File not found",
      });
    }

    const file = result.rows[0];

    // Create a temporary signed URL
    const { data, error } = await supabase.storage
      .from("drive")
      .createSignedUrl(file.storage_key, 60);

    if (error) {
      console.error("Signed URL error:", error.message);

      return res.status(500).json({
        message: "Failed to generate file access URL",
      });
    }

    return res.status(200).json({
      message: "File access URL generated successfully",
      file: {
        id: file.id,
        name: file.name,
        mime_type: file.mime_type,
      },
      download_url: data.signedUrl,
      expires_in: 60,
    });
  } catch (error) {
    console.error("Download file error:", error.message);

    return res.status(500).json({
      message: "Failed to access file",
    });
  }
};

const deleteFile = async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.user.id;

    // Find the file and verify ownership
    const result = await pool.query(
      `UPDATE files
       SET
         is_deleted = true,
         updated_at = now()
       WHERE id = $1
         AND owner_id = $2
         AND is_deleted = false
       RETURNING
         id,
         name,
         mime_type,
         size_bytes,
         storage_key,
         owner_id,
         folder_id,
         checksum,
         is_deleted,
         created_at,
         updated_at`,
      [id, ownerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "File not found",
      });
    }

    return res.status(200).json({
      message: "File deleted successfully",
      file: result.rows[0],
    });
  } catch (error) {
    console.error("Delete file error:", error.message);

    return res.status(500).json({
      message: "Failed to delete file",
    });
  }
};

const getTrashFiles = async (req, res) => {
  try {
    const ownerId = req.user.id;

    const result = await pool.query(
      `SELECT
         id,
         name,
         mime_type,
         size_bytes,
         storage_key,
         owner_id,
         folder_id,
         checksum,
         is_deleted,
         created_at,
         updated_at
       FROM files
       WHERE owner_id = $1
         AND is_deleted = true
       ORDER BY updated_at DESC`,
      [ownerId]
    );

    return res.status(200).json({
      message: "Trash files fetched successfully",
      files: result.rows,
    });
  } catch (error) {
    console.error("Get trash files error:", error.message);

    return res.status(500).json({
      message: "Failed to fetch trash files",
    });
  }
};

const restoreFile = async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.user.id;

    const result = await pool.query(
      `UPDATE files
       SET
         is_deleted = false,
         updated_at = now()
       WHERE id = $1
         AND owner_id = $2
         AND is_deleted = true
       RETURNING
         id,
         name,
         mime_type,
         size_bytes,
         storage_key,
         owner_id,
         folder_id,
         checksum,
         is_deleted,
         created_at,
         updated_at`,
      [id, ownerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Deleted file not found",
      });
    }

    return res.status(200).json({
      message: "File restored successfully",
      file: result.rows[0],
    });
  } catch (error) {
    console.error("Restore file error:", error.message);

    return res.status(500).json({
      message: "Failed to restore file",
    });
  }
};

const permanentDeleteFile = async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.user.id;

    // Find the deleted file and verify ownership
    const result = await pool.query(
      `SELECT
         id,
         name,
         storage_key,
         owner_id,
         is_deleted
       FROM files
       WHERE id = $1
         AND owner_id = $2
         AND is_deleted = true`,
      [id, ownerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Deleted file not found",
      });
    }

    const file = result.rows[0];

    // Delete the actual file from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from("drive")
      .remove([file.storage_key]);

    if (storageError) {
      console.error(
        "Permanent storage deletion error:",
        storageError.message
      );

      return res.status(500).json({
        message: "Failed to permanently delete file from storage",
      });
    }

    // Delete the file metadata from PostgreSQL
    await pool.query(
      `DELETE FROM files
       WHERE id = $1
         AND owner_id = $2
         AND is_deleted = true`,
      [id, ownerId]
    );

    return res.status(200).json({
      message: "File permanently deleted successfully",
      file: {
        id: file.id,
        name: file.name,
      },
    });
  } catch (error) {
    console.error("Permanent delete file error:", error.message);

    return res.status(500).json({
      message: "Failed to permanently delete file",
    });
  }
};

module.exports = {
  uploadFile,
  getFiles,
  downloadFile,
  deleteFile,
  getTrashFiles,
  restoreFile,
  permanentDeleteFile,
};