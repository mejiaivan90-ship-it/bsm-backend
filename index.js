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

// 🔹 CANDIDATES (CORREGIDO Y ROBUSTO)
app.get("/candidates", async (req, res) => {
  try {
    const { jobId } = req.query;

    if (!jobId) {
      return res.status(400).json({ error: "jobId es requerido" });
    }

    const data = await getSheetData("Candidatos");

    // 🔥 NORMALIZAR jobId (Job00210 → 00210)
    const cleanJobId = String(jobId).replace("Job", "").trim();

    const filtered = data.filter((item) => {
      const rawId = String(item.ID || "").trim();
      const normalized = rawId.replace("Job", "").trim();

      return normalized === cleanJobId;
    });

    const candidates = filtered.map((item, index) => {
      // 🔥 NOMBRE (CORREGIDO: LastName vs Last Name)
      const firstName = item.Name || "";
      const lastName =
        item.LastName || item["Last Name"] || item.lastname || "";

      const fullName = `${firstName} ${lastName}`.trim();

      // 🔥 ETAPA (PRIORIDAD A currentStage)
      let stage = (item.currentStage || "").trim();

      if (!stage) {
        if (item.RCNL === "SI") stage = "RCNL";
        else if (item.RCVS === "SI") stage = "RCVS";
        else if (item.RIWH === "SI") stage = "RIWH";
        else if (item.RCCA === "SI") stage = "RCCA";
      }

      return {
        id: item.ID || `${jobId}_${index + 1}`,
        jobId: jobId,
        name: fullName || "Candidato",
        firstName,
        lastName,
        status: item.STATUS || "",
        currentStage: stage || "",
        RCCA: item.RCCA,
        RIWH: item.RIWH,
        RCVS: item.RCVS,
        RCNL: item.RCNL,
        raw: item,
      };
    });

    res.json({
      jobId,
      count: candidates.length,
      candidates,
    });
  } catch (error) {
    console.log(error);
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
