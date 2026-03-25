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
  let data = await response.json();

  // 🔥 NORMALIZAR KEYS
  data = data.map((row) => {
    const newRow = {};
    Object.keys(row).forEach((key) => {
      newRow[key.trim()] = row[key];
    });
    return newRow;
  });

  return data;
}

// 🔹 TEST
app.get("/", (req, res) => {
  res.json({ status: "API funcionando con Sheets" });
});

app.get("/scorecard", async (req, res) => {
  try {
    const { id = "", jobId = "" } = req.query;

    const clean = (s) =>
      String(s || "")
        .toLowerCase()
        .trim();

    const normalizeName = (name) =>
      String(name || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    // ⚠️ IMPORTANTE: nombre correcto del sheet
    const rows = await getSheetData("Score Card");

    if (!rows || rows.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // ===============================
    // ✅ NUEVO: POR JOB ID
    // ===============================
    if (jobId) {
      const candidatesData = await getSheetData("Candidatos");

      const cleanJobId = String(jobId).replace("Job", "").trim();

      const filteredCandidates = candidatesData.filter((item) => {
        const rawId = String(item["ID "] || item.ID || "").trim();
        const normalized = rawId.replace("Job", "").replace(/^0+/, "").trim();
        const target = cleanJobId.replace(/^0+/, "").trim();
        return normalized === target;
      });

      const candidateNames = filteredCandidates.map((item) => {
        const first = item["Name "] || item.Name || "";
        const last =
          item["Last Name "] || item["Last Name"] || item.LastName || "";
        return normalizeName(`${first} ${last}`);
      });

      const filteredScorecards = rows.filter((row) => {
        const name =
          row.Name ||
          row["Name "] ||
          row.Nombre ||
          row.nombre ||
          row.Candidate ||
          "";

        const last =
          row["Last Name"] ||
          row["Last Name "] ||
          row.LastName ||
          row.Apellido ||
          row.lastName ||
          "";

        const full = normalizeName(`${name} ${last}`);

        return candidateNames.includes(full);
      });

      return res.json({
        success: true,
        data: filteredScorecards,
      });
    }

    // ===============================
    // ✅ ORIGINAL (NO SE ROMPE)
    // ===============================
    if (id) {
      const queryId = clean(id);

      let match = rows.find((row) => {
        const rowId = clean(row.ID || row.Id || row.id);
        return rowId === queryId;
      });

      if (!match) {
        match = rows.find((row) => {
          const rowId = clean(row.ID || row.Id || row.id);
          return rowId.includes(queryId);
        });
      }

      return res.json({
        success: true,
        data: match || {},
      });
    }

    return res.json({
      success: true,
      data: [],
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error obteniendo scorecard" });
  }
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

// 🔹 CANDIDATES
app.get("/candidates", async (req, res) => {
  try {
    const { jobId } = req.query;

    if (!jobId) {
      return res.status(400).json({ error: "jobId es requerido" });
    }

    const candidatesData = await getSheetData("Candidatos");
    const scoreData = await getSheetData("Score Card");

    const cleanJobId = String(jobId).replace("Job", "").trim();

    const filtered = candidatesData.filter((item) => {
      const rawId = String(item["ID "] || item.ID || "").trim();
      const normalized = rawId.replace("Job", "").replace(/^0+/, "").trim();
      const target = cleanJobId.replace(/^0+/, "").trim();
      return normalized === target;
    });

    const normalizeName = (name) =>
      String(name || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    const scoreMap = {};

    scoreData.forEach((item) => {
      const name =
        item.Name || item.Nombre || item.nombre || item.Candidate || "";

      if (!name) return;

      const key = normalizeName(name);
      scoreMap[key] = item;
    });

    const candidates = filtered.map((item, index) => {
      const firstName = item["Name "] || item.Name || "";
      const lastName =
        item["Last Name "] || item["Last Name"] || item.LastName || "";

      const fullName = `${firstName} ${lastName}`.trim();
      const normalizedFullName = normalizeName(fullName);

      const scoreRow = scoreMap[normalizedFullName] || {};

      const score =
        Number(scoreRow.Score) ||
        Number(scoreRow["Score 1-100"]) ||
        Number(scoreRow.score) ||
        0;

      let stage = (item.currentStage || "").trim();

      if (!stage) {
        if (item.RCNL === "SI") stage = "RCNL";
        else if (item.RCVS === "SI") stage = "RCVS";
        else if (item.RIWH === "SI") stage = "RIWH";
        else if (item.RCCA === "SI") stage = "RCCA";
      }

      return {
        id: `${jobId}_${index + 1}`,
        jobId,
        name: fullName,
        firstName,
        lastName,
        status: item.STATUS || "",
        currentStage: stage || "",
        score: score || 0,
        scoreData: scoreRow,
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

// 🔹 LOGIN
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
