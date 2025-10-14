import express from "express";

const app = express();
app.use(express.json());

const PORT = 4000;

// GET test
app.get("/", (req, res) => {
  res.send("✅ GET route working!");
});

// POST test
app.post("/test", (req, res) => {
  console.log("📩 Body received:", req.body);
  res.json({ message: "✅ POST route working", data: req.body });
});

app.listen(PORT, () => {
  console.log(`🚀 Test server running at http://localhost:${PORT}`);
});