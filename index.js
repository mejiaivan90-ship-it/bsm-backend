import cors from "cors";
import express from "express";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

const SHEET_ID = "1B5-aI6x9xWTDkFikCpSdnTF4yJ1lZFuXu4PjpPBVICQ";

// 🔹 Leer Google Sheets
async function getSheetData(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

  const response = await fetch(url);
  const text = await response.text();

  const json = JSON.parse(text.substring(47).slice(0, -2));
  const rows = json.table.rows;

  return rows.map((row) => row.c.map((cell) => (cell ? cell.v : "")));
}

// 🔹 TEST
app.get("/", (req, res) => {
  res.json({ status: "API funcionando con Sheets" });
});

// 🔹 POSICIONES
app.get("/positions", async (req, res) => {
  try {
    const data = await getSheetData("Posiciones");
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo posiciones" });
  }
});

// 🔹 CANDIDATOS
app.get("/candidates", async (req, res) => {
  try {
    const data = await getSheetData("Candidatos");
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo candidatos" });
  }
});

// 🔹 CLIENTES (por si lo usas después)
app.get("/clientes", async (req, res) => {
  try {
    const data = await getSheetData("Clientes");
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo clientes" });
  }
});

// 🔹 SCORE CARD (por si lo usas)
app.get("/scorecard", async (req, res) => {
  try {
    const data = await getSheetData("Score card");
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo scorecard" });
  }
});

// 🔹 LOGIN
app.post("/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (email === "cliente@demo.com" && password === "123456") {
    return res.json({
      token: "demo-token",
      companyName: "Demo Company",
      email,
      logoUrl: "",
    });
  }

  return res.status(401).json({
    error: "Credenciales incorrectas",
  });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
