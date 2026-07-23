const express = require("express");
const app = express();

app.use(express.json());
app.use("/api", require("./index"));

const PORT = process.env.BACKEND_PORT || 3001;
app.listen(PORT, () =>
  console.log(`Backend running on http://localhost:${PORT}`),
);
