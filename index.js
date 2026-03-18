import cors from "cors";
import express from "express";
import fetch from "node-fetch";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

const SHEET_ID = "1B5-aI6x9xWTDkFikCpSdnTF4yJ1lZFuXu4PjpPBVICQ";

// 🔹 Leer Google Sheets
async function getSheetData(sheetName) {
  const url = `https://opensheet.elk.sh/${SHEET_ID}/${encodeURIComponent(sheetName)}`;

  const response = await fetch(url);
  const data = await response.json();

  return data;
}

// 🔹 TEST
app.get("/", (req, res) => {
  res.json({ status: "API funcionando con Sheets" });
});

// 🔹 POSICIONES (IMPORTANTE: usamos este formato)
app.get("/posiciones", async (req, res) => {
  try {
    const data = await getSheetData("Posiciones");
    res.json({ positions: data });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error obteniendo posiciones" });
  }
});

// 🔹 CANDIDATOS
app.get("/candidatos", async (req, res) => {
  try {
    const data = await getSheetData("Candidatos");
    res.json({ candidates: data });
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo candidatos" });
  }
});

// 🔹 CLIENTES
app.get("/clientes", async (req, res) => {
  try {
    const data = await getSheetData("Clientes");
    res.json({ clients: data });
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo clientes" });
  }
});

// 🔹 SCORE CARD
app.get("/scorecard", async (req, res) => {
  try {
    const data = await getSheetData("Score card");
    res.json({ scorecard: data });
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
