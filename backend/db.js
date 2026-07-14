const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
  ssl: {
    rejectUnauthorized: false,
  },
});

const POSTGRES_PASSWORD = process.env.PGPASSWORD;
if (typeof POSTGRES_PASSWORD !== "string") {
  console.log("PW " + typeof POSTGRES_PASSWORD + " " + POSTGRES_PASSWORD);
  throw new Error("Password must be a string");
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};
