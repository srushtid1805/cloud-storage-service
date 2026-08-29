require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const email = "test@gmail.com";
const password = "Test@12345";

async function login() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Login failed:", error.message);
    return;
  }

  console.log("Login successful!");
  console.log("Access Token:");
  console.log(data.session.access_token);
}

login();