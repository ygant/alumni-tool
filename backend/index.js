var express = require("express");
var bcrypt = require("bcrypt");
var router = express.Router();
var db = require("./db");

const SALT_ROUNDS = 12;

const INDUSTRY_CATEGORIES = [
  "Agriculture",
  "Environmental Engineering",
  "Water Resources",
  "Biological/Biotechnology",
  "Food & Beverage",
  "Energy & Utilities",
  "Engineering & Consulting",
  "Construction & Infrastructure",
  "Technology & Data Analytics",
  "Government & Public Service",
  "Research & Education",
  "Manufacturing & Operations",
  "Business & Management",
  "Other",
];

// Get everyone (for display / admin purposes) — never send password back
router.get("/alumni", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, classification, name, email, company, job_title, work_city, work_state, work_country
       FROM alumni ORDER BY name`,
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching alumni:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Profile
router.get("/alumni/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const alumniResult = await db.query(
      `SELECT id, classification, name, email, company, job_title, job_description, research,
              industry_category, work_city, work_state, work_country, linkedin_url,
              seeking_internship, seeking_fulltime, seeking_grad_school, open_to_research, bio
       FROM alumni WHERE id = $1`,
      [id],
    );

    if (alumniResult.rows.length === 0) {
      return res.status(404).json({ error: "Profile not found." });
    }

    const degreesResult = await db.query(
      `SELECT id, degree_level, degree_name, year_conferred
       FROM alumni_degrees WHERE alumni_id = $1 ORDER BY year_conferred`,
      [id],
    );

    res.json({ ...alumniResult.rows[0], degrees: degreesResult.rows });
  } catch (err) {
    console.error("Error fetching profile:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Sign up
router.post("/alumni", async (req, res) => {
  const {
    classification,
    name,
    email,
    password,
    degree_level,
    degree_name,
    year_conferred,
  } = req.body;

  if (
    !classification ||
    !name ||
    !email ||
    !password ||
    !degree_level ||
    !degree_name ||
    !year_conferred
  ) {
    return res.status(400).json({ error: "Please fill out every field." });
  }

  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const alumniResult = await client.query(
      `INSERT INTO alumni (classification, name, email, password)
       VALUES ($1, $2, $3, $4)
       RETURNING id, classification, name, email`,
      [classification, name, email.toLowerCase().trim(), hashedPassword],
    );

    const alumniId = alumniResult.rows[0].id;

    await client.query(
      `INSERT INTO alumni_degrees (alumni_id, degree_level, degree_name, year_conferred)
       VALUES ($1, $2, $3, $4)`,
      [alumniId, degree_level, degree_name, year_conferred],
    );

    await client.query("COMMIT");
    res.status(201).json(alumniResult.rows[0]);
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
      `SELECT id, classification, name, email, password FROM alumni WHERE email = $1`,
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

// Update profile
router.put("/alumni/:id", async (req, res) => {
  const { id } = req.params;
  const {
    company,
    job_title,
    job_description,
    research,
    industry_category,
    work_city,
    work_state,
    work_country,
    linkedin_url,
    seeking_internship,
    seeking_fulltime,
    seeking_grad_school,
    open_to_research,
    bio,
  } = req.body;

  if (industry_category && !INDUSTRY_CATEGORIES.includes(industry_category)) {
    return res.status(400).json({ error: "Invalid industry category." });
  }

  try {
    const result = await db.query(
      `UPDATE alumni SET
        company = COALESCE($1, company),
        job_title = COALESCE($2, job_title),
        job_description = COALESCE($3, job_description),
        research = COALESCE($4, research),
        industry_category = COALESCE($5, industry_category),
        work_city = COALESCE($6, work_city),
        work_state = COALESCE($7, work_state),
        work_country = COALESCE($8, work_country),
        linkedin_url = COALESCE($9, linkedin_url),
        seeking_internship = COALESCE($10, seeking_internship),
        seeking_fulltime = COALESCE($11, seeking_fulltime),
        seeking_grad_school = COALESCE($12, seeking_grad_school),
        open_to_research = COALESCE($13, open_to_research),
        bio = COALESCE($14, bio)
       WHERE id = $15
       RETURNING id, classification, name, email, company, job_title, job_description, research,
                 industry_category, work_city, work_state, work_country, linkedin_url,
                 seeking_internship, seeking_fulltime, seeking_grad_school, open_to_research, bio`,
      [
        company,
        job_title,
        job_description,
        research,
        industry_category,
        work_city,
        work_state,
        work_country,
        linkedin_url,
        seeking_internship,
        seeking_fulltime,
        seeking_grad_school,
        open_to_research,
        bio,
        id,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Profile not found." });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Add a degree
router.post("/alumni/:id/degrees", async (req, res) => {
  const { id } = req.params;
  const { degree_level, degree_name, year_conferred } = req.body;

  if (!degree_level || !degree_name || !year_conferred) {
    return res
      .status(400)
      .json({ error: "Degree level, name, and year are required." });
  }

  try {
    const result = await db.query(
      `INSERT INTO alumni_degrees (alumni_id, degree_level, degree_name, year_conferred)
       VALUES ($1, $2, $3, $4)
       RETURNING id, degree_level, degree_name, year_conferred`,
      [id, degree_level, degree_name, year_conferred],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Add degree error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Remove a degree
router.delete("/alumni/:id/degrees/:degreeId", async (req, res) => {
  const { id, degreeId } = req.params;
  try {
    const result = await db.query(
      `DELETE FROM alumni_degrees WHERE id = $1 AND alumni_id = $2 RETURNING id`,
      [degreeId, id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Degree not found." });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Delete degree error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
