var express = require("express");
var crypto = require("crypto");
var bcrypt = require("bcrypt");
var router = express.Router();
var db = require("./db");
var {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendMfaCodeEmail,
} = require("./mailer");

const SALT_ROUNDS = 12;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const INDUSTRY_CATEGORIES = [
  "Power Machinery",
  "Instrumentation and Controls",
  "Air Quality",
  "Bioenergy",
  "Food Engineering",
  "Water Availability and Quality",
  "Water Conservation",
  "Wastewater",
  "Structures",
  "Data Analytics",
  "GIS",
  "Management",
  "Engineering Technician",
  "Sales",
  "Technical Sales",
  "Irrigation Systems Manager",
  "Production Supervisor",
  "Logistics",
  "Project Administrator",
  "Surveying",
  "Staff Consultant",
  "Technical Support Specialist",
  "Military",
  "Teacher",
  "Educator",
  "Safety Training",
  "Safety Manager",
  "Safety",
  "Government",
  "Farm Manager",
  "Ranch Manager",
  "Rain Water Harvesting",
  "Construction",
  "Consulting",
  "Installer",
  "Electrician",
  "Energy Management",
  "Resource Management",
  "Land Development",
  "Permitting",
  "Environmental Consulting",
  "Energy",
  "Farmer/Rancher",
  "Entrepreneur",
];

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// MFA can be turned off for local testing by putting MFA_ENABLED=false in .env.
// If the setting is missing or anything other than "false", MFA stays ON.
const MFA_ENABLED =
  (process.env.MFA_ENABLED || "true").trim().toLowerCase() !== "false";
if (!MFA_ENABLED) {
  console.warn("WARNING: MFA is DISABLED (MFA_ENABLED=false). Do not use in production.");
}

async function isAdminRequester(requesterId) {
  if (!requesterId) return false;
  const result = await db.query(`SELECT email FROM alumni WHERE id = $1`, [
    requesterId,
  ]);
  if (result.rows.length === 0) return false;
  return ADMIN_EMAILS.includes(result.rows[0].email.toLowerCase());
}

// ---------- Token helpers ----------

function generateUrlToken() {
  return crypto.randomBytes(32).toString("hex");
}

function generateMfaCode(length = 12) {
  const charset = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += charset[bytes[i] % charset.length];
  }
  return code;
}

async function createToken(client, alumniId, type, token, expiresInMs) {
  const expiresAt = new Date(Date.now() + expiresInMs);
  await client.query(
    `INSERT INTO auth_tokens (alumni_id, token, type, expires_at) VALUES ($1, $2, $3, $4)`,
    [alumniId, token, type, expiresAt],
  );
}

// ---------- Directory listing ----------
router.get("/alumni", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, classification, first_name AS "firstName", last_name AS "lastName", email, company, job_title, work_city, work_state, work_country
       FROM alumni ORDER BY last_name, first_name`,
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching alumni:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ---------- Verify email ----------
// MUST COME BEFORE /alumni/:id
router.get("/alumni/verify-email", async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ error: "Missing verification token." });
  }

  try {
    const tokenResult = await db.query(
      `SELECT id, alumni_id FROM auth_tokens
       WHERE token = $1 AND type = 'email_verify' AND used = FALSE AND expires_at > NOW()`,
      [token],
    );

    if (tokenResult.rows.length === 0) {
      return res
        .status(400)
        .json({ error: "This verification link is invalid or has expired." });
    }

    const { id: tokenId, alumni_id: alumniId } = tokenResult.rows[0];

    await db.query(`UPDATE alumni SET email_verified = TRUE WHERE id = $1`, [
      alumniId,
    ]);
    await db.query(`UPDATE auth_tokens SET used = TRUE WHERE id = $1`, [
      tokenId,
    ]);

    res.json({
      success: true,
      message: "Your email has been verified. You may now log in.",
    });
  } catch (err) {
    console.error("Email verification error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ---------- Single profile (with degrees) ----------
router.get("/alumni/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const alumniResult = await db.query(
      `SELECT id, classification, first_name AS "firstName", last_name AS "lastName", email, company, job_title, job_description,
              industry_category, work_city, work_state, work_country, work_zipcode, linkedin_url,
              seeking_internship, seeking_fulltime, seeking_grad_school, bio,
              hiring_employees, reconnect_baen, capstone_client, baen_activities,
              baen_updates, baen_fundraising, visit_department, last_modified
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

// ---------- Sign up ----------
router.post("/alumni", async (req, res) => {
  const {
    classification,
    firstName,
    lastName,
    email,
    password,
    degree_level,
    degree_name,
    year_conferred,
  } = req.body;

  if (
    !classification ||
    !firstName?.trim() ||
    !lastName?.trim() ||
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
    const normalizedEmail = email.toLowerCase().trim();
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();

    const alumniResult = await client.query(
      `INSERT INTO alumni (classification, first_name, last_name, email, password)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, classification, first_name AS "firstName", last_name AS "lastName", email`,
      [classification, cleanFirst, cleanLast, normalizedEmail, hashedPassword],
    );

    const alumniId = alumniResult.rows[0].id;

    await client.query(
      `INSERT INTO alumni_degrees (alumni_id, degree_level, degree_name, year_conferred)
       VALUES ($1, $2, $3, $4)`,
      [alumniId, degree_level, degree_name, year_conferred],
    );

    const verifyToken = generateUrlToken();
    await createToken(
      client,
      alumniId,
      "email_verify",
      verifyToken,
      24 * 60 * 60 * 1000,
    );

    await client.query("COMMIT");

    const verifyLink = `${FRONTEND_URL}/verify-email?token=${verifyToken}`;
    try {
      await sendVerificationEmail(normalizedEmail, cleanFirst, verifyLink);
    } catch (emailErr) {
      console.error("Failed to send verification email:", emailErr);
    }

    res.status(201).json({
      ...alumniResult.rows[0],
      message: "Please check your email to verify your account.",
    });
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

// ---------- Resend verification email ----------
router.post("/alumni/resend-verification", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Please enter your email address." });
  }

  const genericMessage = {
    message:
      "If an account exists for that email and needs verifying, a new link has been sent.",
  };

  try {
    const result = await db.query(
      `SELECT id, first_name AS "firstName", last_name AS "lastName", email, email_verified FROM alumni WHERE email = $1`,
      [email.toLowerCase().trim()],
    );

    if (result.rows.length === 0 || result.rows[0].email_verified) {
      return res.json(genericMessage);
    }

    const user = result.rows[0];
    const verifyToken = generateUrlToken();
    const client = await db.getClient();
    try {
      await client.query("BEGIN");
      await createToken(
        client,
        user.id,
        "email_verify",
        verifyToken,
        24 * 60 * 60 * 1000,
      );
      await client.query("COMMIT");
    } finally {
      client.release();
    }

    const verifyLink = `${FRONTEND_URL}/verify-email?token=${verifyToken}`;
    await sendVerificationEmail(user.email, user.firstName, verifyLink);

    res.json(genericMessage);
  } catch (err) {
    console.error("Resend verification error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ---------- Log in: step 1 (password check, triggers MFA email) ----------
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
      `SELECT id, first_name AS "firstName", last_name AS "lastName", email, password, email_verified FROM alumni WHERE email = $1`,
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

    if (!user.email_verified) {
      return res.status(403).json({
        error:
          "Please verify your email before logging in. Check your inbox for the verification link.",
        needsVerification: true,
      });
    }

    // MFA turned off: log in straight away with the same info /verify-mfa returns
    if (!MFA_ENABLED) {
      const isAdmin = ADMIN_EMAILS.includes(user.email.toLowerCase());
      return res.json({
        mfaRequired: false,
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isAdmin,
      });
    }

    const mfaCode = generateMfaCode();
    const client = await db.getClient();
    try {
      await client.query("BEGIN");
      await createToken(client, user.id, "mfa", mfaCode, 10 * 60 * 1000);
      await client.query("COMMIT");
    } finally {
      client.release();
    }

    await sendMfaCodeEmail(user.email, user.firstName, mfaCode);

    res.json({ mfaRequired: true, alumniId: user.id });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ---------- Log in: step 2 (verify MFA code) ----------
router.post("/alumni/verify-mfa", async (req, res) => {
  const { alumniId, code } = req.body;

  if (!alumniId || !code) {
    return res.status(400).json({ error: "Please enter your login code." });
  }

  const genericError = { error: "That code is incorrect or has expired." };

  try {
    // FIX 1: Pass JavaScript's current time as $2 instead of relying on PostgreSQL's NOW()
    // This ensures the exact same clock is used for creation and validation.
    const tokenResult = await db.query(
      `SELECT id, token, attempts FROM auth_tokens
       WHERE alumni_id = $1 AND type = 'mfa' AND used = FALSE AND expires_at > $2
       ORDER BY created_at DESC LIMIT 1`,
      [alumniId, new Date()],
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json(genericError);
    }

    const tokenRow = tokenResult.rows[0];

    if (tokenRow.attempts >= 5) {
      return res.status(429).json({
        error:
          "Too many incorrect attempts. Please log in again to get a new code.",
      });
    }

    // FIX 2: Add .trim() to tokenRow.token in case your database column pads with spaces
    if (tokenRow.token.trim() !== code.toUpperCase().trim()) {
      await db.query(
        `UPDATE auth_tokens SET attempts = attempts + 1 WHERE id = $1`,
        [tokenRow.id],
      );
      return res.status(401).json(genericError);
    }

    await db.query(`UPDATE auth_tokens SET used = TRUE WHERE id = $1`, [
      tokenRow.id,
    ]);

    const userResult = await db.query(
      `SELECT id, classification, first_name AS "firstName", last_name AS "lastName", email FROM alumni WHERE id = $1`,
      [alumniId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Account not found." });
    }

    const user = userResult.rows[0];
    const isAdmin = ADMIN_EMAILS.includes(user.email.toLowerCase());

    res.json({ ...user, isAdmin });
  } catch (err) {
    console.error("MFA verification error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ---------- Forgot password ----------
router.post("/alumni/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Please enter your email address." });
  }

  const genericMessage = {
    message:
      "If an account exists for that email, a password reset link has been sent.",
  };

  try {
    const result = await db.query(
      `SELECT id, first_name AS "firstName", last_name AS "lastName", email FROM alumni WHERE email = $1`,
      [email.toLowerCase().trim()],
    );

    if (result.rows.length === 0) {
      return res.json(genericMessage);
    }

    const user = result.rows[0];
    const resetToken = generateUrlToken();
    const client = await db.getClient();
    try {
      await client.query("BEGIN");
      await createToken(
        client,
        user.id,
        "password_reset",
        resetToken,
        60 * 60 * 1000,
      );
      await client.query("COMMIT");
    } finally {
      client.release();
    }

    const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
    await sendPasswordResetEmail(user.email, user.firstName, resetLink);

    res.json(genericMessage);
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ---------- Reset password ----------
router.post("/alumni/reset-password", async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: "Missing token or new password." });
  }

  try {
    const tokenResult = await db.query(
      `SELECT id, alumni_id FROM auth_tokens
       WHERE token = $1 AND type = 'password_reset' AND used = FALSE AND expires_at > $2`,
      [token, new Date()],
    );

    if (tokenResult.rows.length === 0) {
      return res
        .status(400)
        .json({ error: "This reset link is invalid or has expired." });
    }

    const { id: tokenId, alumni_id: alumniId } = tokenResult.rows[0];
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    await db.query(`UPDATE alumni SET password = $1 WHERE id = $2`, [
      hashedPassword,
      alumniId,
    ]);
    await db.query(`UPDATE auth_tokens SET used = TRUE WHERE id = $1`, [
      tokenId,
    ]);

    res.json({
      success: true,
      message: "Your password has been updated. You may now log in.",
    });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ---------- Update profile ----------
router.put("/alumni/:id", async (req, res) => {
  const { id } = req.params;
  const {
    classification,
    company,
    job_title,
    job_description,
    industry_category,
    work_city,
    work_state,
    work_country,
    work_zipcode,
    linkedin_url,
    seeking_internship,
    seeking_fulltime,
    seeking_grad_school,
    bio,
    hiring_employees,
    reconnect_baen,
    capstone_client,
    baen_activities,
    baen_updates,
    baen_fundraising,
    visit_department,
  } = req.body;

  if (industry_category && !INDUSTRY_CATEGORIES.includes(industry_category)) {
    return res.status(400).json({ error: "Invalid industry category." });
  }

  try {
    const result = await db.query(
      `UPDATE alumni SET
        classification = COALESCE($1, classification),
        company = COALESCE($2, company),
        job_title = COALESCE($3, job_title),
        job_description = COALESCE($4, job_description),
        industry_category = COALESCE($5, industry_category),
        work_city = COALESCE($6, work_city),
        work_state = COALESCE($7, work_state),
        work_country = COALESCE($8, work_country),
        work_zipcode = COALESCE($9, work_zipcode),
        linkedin_url = COALESCE($10, linkedin_url),
        seeking_internship = COALESCE($11, seeking_internship),
        seeking_fulltime = COALESCE($12, seeking_fulltime),
        seeking_grad_school = COALESCE($13, seeking_grad_school),
        bio = COALESCE($14, bio),
        hiring_employees = COALESCE($15, hiring_employees),
        reconnect_baen = COALESCE($16, reconnect_baen),
        capstone_client = COALESCE($17, capstone_client),
        baen_activities = COALESCE($18, baen_activities),
        baen_updates = COALESCE($19, baen_updates),
        baen_fundraising = COALESCE($20, baen_fundraising),
        visit_department = COALESCE($21, visit_department),
        last_modified = NOW()
       WHERE id = $22
       RETURNING id, last_modified`,
      [
        classification,
        company,
        job_title,
        job_description,
        industry_category,
        work_city,
        work_state,
        work_country,
        work_zipcode,
        linkedin_url,
        seeking_internship,
        seeking_fulltime,
        seeking_grad_school,
        bio,
        hiring_employees,
        reconnect_baen,
        capstone_client,
        baen_activities,
        baen_updates,
        baen_fundraising,
        visit_department,
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

// ---------- Add / remove degrees ----------
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
    await db.query(`UPDATE alumni SET last_modified = NOW() WHERE id = $1`, [id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Add degree error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

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
    await db.query(`UPDATE alumni SET last_modified = NOW() WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete degree error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Companies
router.get("/companies", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT company FROM alumni
       WHERE company IS NOT NULL AND TRIM(company) != ''
       ORDER BY company`,
    );
    res.json(result.rows.map((r) => r.company));
  } catch (err) {
    console.error("Error fetching companies:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Admin Directory
router.get("/admin/alumni", async (req, res) => {
  const { requesterId } = req.query;

  try {
    const allowed = await isAdminRequester(requesterId);
    if (!allowed) {
      return res
        .status(403)
        .json({ error: "You are not authorized to view this page." });
    }

    const result = await db.query(
      `
      SELECT
        a.id, a.classification, a.first_name AS "firstName", a.last_name AS "lastName", a.email, a.company, a.job_title,
        a.industry_category, a.work_city, a.work_state, a.work_country,
        a.seeking_internship, a.seeking_fulltime, a.seeking_grad_school,
        COALESCE(
          STRING_AGG(d.degree_name || ' (' || d.year_conferred || ')', ', ' ORDER BY d.year_conferred),
          ''
        ) AS degrees
      FROM alumni a
      LEFT JOIN alumni_degrees d ON d.alumni_id = a.id
      WHERE LOWER(a.email) != ALL($1::text[])
      GROUP BY a.id
      ORDER BY a.last_name, a.first_name
      `,
      [ADMIN_EMAILS],
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Admin alumni fetch error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
