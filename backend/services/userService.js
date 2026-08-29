const pool = require("../config/db");

const createOrGetUser = async (authUser) => {
  const existingUser = await pool.query(
    "SELECT id, email, name, image_url, created_at FROM users WHERE id = $1",
    [authUser.id]
  );

  if (existingUser.rows.length > 0) {
    return existingUser.rows[0];
  }

  const name = authUser.user_metadata?.name || null;

  const result = await pool.query(
    `INSERT INTO users (id, email, name)
     VALUES ($1, $2, $3)
     RETURNING id, email, name, image_url, created_at`,
    [authUser.id, authUser.email, name]
  );

  return result.rows[0];
};

module.exports = {
  createOrGetUser,
};