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
  const url = `https://opensheet.elk.sh/${SHEET_ID}/${encodeURIComponent(
    sheetName,
  )}`;

  const response = await fetch(url);
  const data = await response.json();

  return data;
}

// 🔹 TEST
app.get("/", (req, res) => {
  res.json({ status: "API funcionando con Sheets" });
});

// 🔹 POSICIONES (RAW)
app.get("/posiciones", async (req, res) => {
  try {
    const data = await getSheetData("Posiciones");
    res.json({ positions: data });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error obteniendo posiciones" });
  }
});

// 🔹 POSITIONS (FORMATO APP)
app.get("/positions", async (req, res) => {
  try {
    const { companyName } = req.query;

    const data = await getSheetData("Posiciones");

    let filtered = data;

    if (companyName) {
      filtered = data.filter(
        (item) =>
          (item.company || "").toLowerCase().trim() ===
          String(companyName).toLowerCase().trim(),
      );
    }

    const positions = filtered.map((item) => ({
      id: item.ID,
      ID: item.ID,
      jobId: `Job${item.ID}`,
      owner: (item.owner || "").trim(),
      company: (item.company || "").trim(),
      positionLocation: (item.positionLocation || "").trim(),
      industry: (item.industry || "").trim(),
      status: (item.status || "").trim(),
    }));

    res.json({
      companyName: companyName || "",
      count: positions.length,
      positions,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error obteniendo positions" });
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

// 🔹 LOGIN (YA CONECTADO A SHEETS)
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const data = await getSheetData("Clientes");

    const user = data.find(
      (item) =>
        (item.email || "").toLowerCase().trim() ===
          String(email).toLowerCase().trim() &&
        (item.password || "").trim() === String(password).trim(),
    );

    if (!user) {
      return res.status(401).json({
        error: "Credenciales incorrectas",
      });
    }

    return res.json({
      token: "real-token",
      companyName: (user.companyName || "").trim(),
      email: (user.email || "").trim(),
      logoUrl: (user.logoUrl || "").trim(),
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en login" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
