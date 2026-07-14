var express = require("express");
var bcrypt = require("bcrypt");
var router = express.Router();
var db = require("./db");

const SALT_ROUNDS = 12;

// Get everyone (for display / admin purposes) — never send password back
router.get("/alumni", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, classification, name, email, year, degree FROM alumni`,
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching alumni:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Sign up
router.post("/alumni", async (req, res) => {
  const { classification, name, email, year, degree, password } = req.body;

  if (!classification || !name || !email || !year || !degree || !password) {
    return res.status(400).json({ error: "Please fill out every field." });
  }

  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await client.query(
      `INSERT INTO alumni (classification, name, email, year, degree, password)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, classification, name, email, year, degree`,
      [
        classification,
        name,
        email.toLowerCase().trim(),
        year,
        degree,
        hashedPassword,
      ],
    );

    await client.query("COMMIT");
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Alumni Creation Error:", err);

    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "An account with that email already exists." });
    }

    res.status(500).json({ error: err.message || "Internal Server Error" });
  } finally {
    client.release();
  }
});

// Log in
router.post("/alumni/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ error: "Please enter your email and password." });
  }

  const genericError = { error: "Email or password is incorrect." };

  try {
    const result = await db.query(
      `SELECT id, classification, name, email, year, degree, password
       FROM alumni WHERE email = $1`,
      [email.toLowerCase().trim()],
    );

    if (result.rows.length === 0) {
      return res.status(401).json(genericError);
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json(genericError);
    }

    delete user.password;
    res.json(user);
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
