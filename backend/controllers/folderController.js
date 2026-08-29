const pool = require("../config/db");

const createFolder = async (req, res) => {
  try {
    const { name, parent_id } = req.body;
    const ownerId = req.user.id;

    // Validate folder name
    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Folder name is required",
      });
    }

    // If a parent folder is provided,
    // make sure it belongs to the current user
    if (parent_id) {
      const parentFolder = await pool.query(
        `SELECT id
         FROM folders
         WHERE id = $1
           AND owner_id = $2
           AND is_deleted = false`,
        [parent_id, ownerId]
      );

      if (parentFolder.rows.length === 0) {
        return res.status(404).json({
          message: "Parent folder not found",
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO folders (name, owner_id, parent_id)
       VALUES ($1, $2, $3)
       RETURNING id, name, owner_id, parent_id, is_deleted, created_at, updated_at`,
      [name.trim(), ownerId, parent_id || null]
    );

    return res.status(201).json({
      message: "Folder created successfully",
      folder: result.rows[0],
    });
  } catch (error) {
    console.error("Create folder error:", error.message);

    return res.status(500).json({
      message: "Failed to create folder",
    });
  }
};

const getFolders = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { parent_id } = req.query;

    let result;

    if (parent_id) {
      // Verify that the requested parent belongs to the user
      const parentFolder = await pool.query(
        `SELECT id
         FROM folders
         WHERE id = $1
           AND owner_id = $2
           AND is_deleted = false`,
        [parent_id, ownerId]
      );

      if (parentFolder.rows.length === 0) {
        return res.status(404).json({
          message: "Parent folder not found",
        });
      }

      result = await pool.query(
        `SELECT
           id,
           name,
           owner_id,
           parent_id,
           is_deleted,
           created_at,
           updated_at
         FROM folders
         WHERE owner_id = $1
           AND parent_id = $2
           AND is_deleted = false
         ORDER BY created_at ASC`,
        [ownerId, parent_id]
      );
    } else {
      // Return only root folders
      result = await pool.query(
        `SELECT
           id,
           name,
           owner_id,
           parent_id,
           is_deleted,
           created_at,
           updated_at
         FROM folders
         WHERE owner_id = $1
           AND parent_id IS NULL
           AND is_deleted = false
         ORDER BY created_at ASC`,
        [ownerId]
      );
    }

    return res.status(200).json({
      message: "Folders fetched successfully",
      folders: result.rows,
    });
  } catch (error) {
    console.error("Get folders error:", error.message);

    return res.status(500).json({
      message: "Failed to fetch folders",
    });
  }
};


const updateFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const ownerId = req.user.id;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Folder name is required",
      });
    }

    const result = await pool.query(
      `UPDATE folders
       SET
         name = $1,
         updated_at = now()
       WHERE id = $2
         AND owner_id = $3
         AND is_deleted = false
       RETURNING
         id,
         name,
         owner_id,
         parent_id,
         is_deleted,
         created_at,
         updated_at`,
      [name.trim(), id, ownerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Folder not found",
      });
    }

    return res.status(200).json({
      message: "Folder updated successfully",
      folder: result.rows[0],
    });
  } catch (error) {
    console.error("Update folder error:", error.message);

    return res.status(500).json({
      message: "Failed to update folder",
    });
  }
};

const deleteFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.user.id;

    const result = await pool.query(
      `WITH RECURSIVE folder_tree AS (
        SELECT id
        FROM folders
        WHERE id = $1
          AND owner_id = $2
          AND is_deleted = false

        UNION ALL

        SELECT f.id
        FROM folders f
        INNER JOIN folder_tree ft
          ON f.parent_id = ft.id
        WHERE f.owner_id = $2
          AND f.is_deleted = false
      )
      UPDATE folders
      SET
        is_deleted = true,
        updated_at = now()
      WHERE id IN (SELECT id FROM folder_tree)
      RETURNING
        id,
        name,
        owner_id,
        parent_id,
        is_deleted,
        created_at,
        updated_at`,
      [id, ownerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Folder not found",
      });
    }

    return res.status(200).json({
      message: "Folder and its contents deleted successfully",
      deletedCount: result.rows.length,
      folders: result.rows,
    });
  } catch (error) {
    console.error("Delete folder error:", error.message);

    return res.status(500).json({
      message: "Failed to delete folder",
    });
  }
};


module.exports = {
  createFolder,
  getFolders,
  updateFolder,
  deleteFolder,
};
