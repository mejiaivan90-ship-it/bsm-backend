require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const CREDS_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || "service-account.json";

// Nombres de pestañas (sub-bases nuevas)
const SHEET_CLIENTES = process.env.SHEET_CLIENTES || "Clientes";
const SHEET_POSICIONES = process.env.SHEET_POSICIONES || "Posiciones";
const SHEET_CANDIDATOS = process.env.SHEET_CANDIDATOS || "Candidatos";
const SHEET_SCORECARD = process.env.SHEET_SCORECARD || "Score card";

// Tu IP LAN (solo para log)
const LAN_IP = process.env.LAN_IP || "192.168.70.9";

/* ---------------- GOOGLE CLIENT ---------------- */

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const authClient = await auth.getClient();
  return google.sheets({ version: "v4", auth: authClient });
}

/* ---------------- HELPERS ---------------- */

function norm(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normKey(s) {
  // Normaliza headers para poder matchear aunque tengan espacios/guiones/underscore
  return String(s || "")
    .replace(/\uFEFF/g, "") // BOM invisible
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "")
    .replace(/-/g, "");
}

function rowsToObjects(values) {
  if (!values || values.length < 2) return [];
  const headers = values[0].map((h) => String(h || "").trim());
  return values.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? "";
    });
    return obj;
  });
}

// Detecta la fila real de headers aunque haya readme/blanks arriba
function findHeaderRowIndex(values, requiredHeaders = []) {
  if (!Array.isArray(values)) return -1;
  const required = (requiredHeaders || []).map((x) => norm(x));
  if (!required.length) return 0;

  for (let i = 0; i < values.length; i++) {
    const row = values[i] || [];
    const normalized = row.map((c) => norm(c));
    const hits = required.filter((h) => normalized.includes(h)).length;

    // con 2 hits suele ser suficiente
    if (hits >= Math.min(2, required.length)) return i;
  }
  return -1;
}

function findKeyByAliases(sampleObj, aliases) {
  if (!sampleObj) return null;
  const keys = Object.keys(sampleObj);
  for (const k of keys) {
    const nk = norm(k);
    if (aliases.some((a) => nk === norm(a))) return k;
  }
  return null;
}

function getCell(rowObj, aliases = []) {
  // 1) match exacto por alias (tu helper)
  const kExact = findKeyByAliases(rowObj, aliases);
  if (kExact) return String(rowObj[kExact] ?? "").trim();

  // 2) match robusto por normalización de key (sin espacios, _, -)
  const keys = Object.keys(rowObj || {});
  const want = aliases.map((a) => normKey(a));
  for (const k of keys) {
    const nk = normKey(k);
    if (want.includes(nk)) return String(rowObj[k] ?? "").trim();
  }

  // 3) match por "contiene" (último recurso)
  for (const k of keys) {
    const nk = normKey(k);
    if (want.some((w) => nk.includes(w))) return String(rowObj[k] ?? "").trim();
  }

  return "";
}

function extractDigits5(input) {
  const s = String(input || "").trim();
  const m = s.match(/\d{5}/);
  return m ? m[0] : "";
}

// - Posiciones trae ID = 00210
// - Candidatos trae ID = Job00210
function toJobId(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const digits = extractDigits5(raw);
  if (!digits) return "";
  return `Job${digits}`;
}

/* ---------------- ROUTES ---------------- */

app.get("/health", (req, res) => res.json({ ok: true }));

/* -------- AUTH LOGIN (Clientes) -------- */
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Faltan email o password" });
    }
    if (!SPREADSHEET_ID) {
      return res
        .status(500)
        .json({ error: "SPREADSHEET_ID no definido en .env" });
    }

    const sheets = await getSheetsClient();
    const range = `${SHEET_CLIENTES}!A:Z`;

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const valuesAll = resp.data.values || [];
    const headerIndex = findHeaderRowIndex(valuesAll, [
      "companyName",
      "email",
      "password",
    ]);
    if (headerIndex === -1) {
      return res.status(500).json({
        error: `No pude encontrar headers en ${SHEET_CLIENTES}`,
      });
    }

    const values = valuesAll.slice(headerIndex);
    const rows = rowsToObjects(values);

    const sample = rows[0] || {};
    const emailKey = findKeyByAliases(sample, ["email"]) || "email";
    const passKey =
      findKeyByAliases(sample, ["password", "pass"]) || "password";
    const companyKey =
      findKeyByAliases(sample, ["companyName", "company", "company name"]) ||
      "companyName";
    const logoKey =
      findKeyByAliases(sample, ["logoUrl", "logo", "logo url"]) || "logoUrl";

    const user = rows.find(
      (r) =>
        String(r[emailKey] || "")
          .toLowerCase()
          .trim() === String(email).toLowerCase().trim() &&
        String(r[passKey] || "").trim() === String(password).trim(),
    );

    if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

    return res.json({
      token: `token_${Date.now()}`,
      companyName: String(user[companyKey] || "").trim(),
      logoUrl: String(user[logoKey] || "").trim(),
      email: String(user[emailKey] || "").trim(),
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({
      error: "Error leyendo Google Sheets (Clientes)",
      detail: String(err.message || err),
    });
  }
});

/* -------- POSITIONS (Posiciones) -------- */
app.get("/positions", async (req, res) => {
  try {
    const companyName = String(req.query.companyName || "").trim();
    if (!companyName)
      return res.status(400).json({ error: "Falta companyName" });
    if (!SPREADSHEET_ID) {
      return res
        .status(500)
        .json({ error: "SPREADSHEET_ID no definido en .env" });
    }

    const sheets = await getSheetsClient();
    const range = `${SHEET_POSICIONES}!A:Z`;

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const valuesAll = resp.data.values || [];
    const headerIndex = findHeaderRowIndex(valuesAll, [
      "ID",
      "company",
      "status",
    ]);
    if (headerIndex === -1) {
      return res.status(500).json({
        error: `No pude encontrar headers en ${SHEET_POSICIONES}`,
      });
    }

    const values = valuesAll.slice(headerIndex);
    const rows = rowsToObjects(values);

    const sample = rows[0] || {};
    const ownerKey = findKeyByAliases(sample, ["owner"]) || "owner";
    const locKey =
      findKeyByAliases(sample, [
        "positionLocation",
        "location",
        "ubicacion",
        "ubicación",
      ]) || "positionLocation";
    const industryKey = findKeyByAliases(sample, ["industry"]) || "industry";
    const statusKey = findKeyByAliases(sample, ["status"]) || "status";
    const idKey = findKeyByAliases(sample, ["id", "ID"]) || "ID";
    const companyKey =
      findKeyByAliases(sample, ["company", "companyName"]) || "company";

    const filtered = rows.filter(
      (r) => norm(r[companyKey]) === norm(companyName),
    );

    const positions = filtered.map((r, idx) => {
      const digits = extractDigits5(r[idKey]);
      const jobId = digits ? `Job${digits}` : "";

      return {
        id: digits ? digits : `row_${idx + 1}`,
        ID: digits ? digits : String(r[idKey] || "").trim(),
        jobId,
        owner: String(r[ownerKey] || "").trim(),
        positionLocation: String(r[locKey] || "").trim(),
        industry: String(r[industryKey] || "").trim(),
        status: String(r[statusKey] || "").trim(),
        company: String(r[companyKey] || "").trim(),
      };
    });

    return res.json({ companyName, count: positions.length, positions });
  } catch (err) {
    console.error("POSITIONS ERROR:", err);
    return res.status(500).json({
      error: "Error leyendo Google Sheets (Posiciones)",
      detail: String(err.message || err),
    });
  }
});

/* -------- CANDIDATES (Candidatos) -------- */
app.get("/candidates", async (req, res) => {
  try {
    const jobId = toJobId(req.query.jobId);
    if (!jobId) {
      return res.status(400).json({ error: "Falta jobId (ej: Job00210)" });
    }
    if (!SPREADSHEET_ID) {
      return res
        .status(500)
        .json({ error: "SPREADSHEET_ID no definido en .env" });
    }

    const sheets = await getSheetsClient();
    const range = `${SHEET_CANDIDATOS}!A:Z`;

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const valuesAll = resp.data.values || [];
    const headerIndex = findHeaderRowIndex(valuesAll, ["ID", "Name", "STATUS"]);
    if (headerIndex === -1) {
      return res.status(500).json({
        error: `No pude encontrar headers en ${SHEET_CANDIDATOS}`,
      });
    }

    const values = valuesAll.slice(headerIndex);
    const rows = rowsToObjects(values);

    const sample = rows[0] || {};
    const idKey =
      findKeyByAliases(sample, ["ID", "id", "jobid", "jobId"]) || "ID";
    const nameKey = findKeyByAliases(sample, ["Name", "nombre"]) || "Name";
    const lastKey =
      findKeyByAliases(sample, ["Last Name", "lastname", "apellido"]) ||
      "Last Name";
    const statusKey =
      findKeyByAliases(sample, ["STATUS", "status"]) || "STATUS";
    const stageKey =
      findKeyByAliases(sample, ["currentStage", "stage", "Current Stage"]) ||
      "currentStage";

    const filtered = rows.filter((r) => norm(r[idKey]) === norm(jobId));

    const candidates = filtered.map((r, idx) => {
      const name = String(r[nameKey] || "").trim();
      const last = String(r[lastKey] || "").trim();
      const fullName = [name, last].filter(Boolean).join(" ").trim();

      return {
        id: `${jobId}_${idx + 1}`,
        jobId,
        name: fullName || "Candidato",
        firstName: name,
        lastName: last,
        status: String(r[statusKey] || "").trim(),
        currentStage: String(r[stageKey] || "").trim(),
        RCCA: String(r.RCCA ?? "").trim(),
        RIWH: String(r.RIWH ?? "").trim(),
        RCVS: String(r.RCVS ?? "").trim(),
        RCNL: String(r.RCNL ?? "").trim(),
      };
    });

    return res.json({ jobId, count: candidates.length, candidates });
  } catch (err) {
    console.error("CANDIDATES ERROR:", err);
    return res.status(500).json({
      error: "Error leyendo Google Sheets (Candidatos)",
      detail: String(err.message || err),
    });
  }
});

/* -------- SCORE CARD (Score card) --------
   GET /scorecard?name=Jaime&lastName=Paredes
   - Match por Name + LastName (case-insensitive)
   - Respuesta: { scorecard: {...} }
*/
app.get("/scorecard", async (req, res) => {
  try {
    const name =
      String(req.query.name || "").trim() ||
      String(req.query.firstName || "").trim() ||
      String(req.query.Name || "").trim();

    const lastName =
      String(req.query.lastName || "").trim() ||
      String(req.query.LastName || "").trim();

    if (!name) return res.status(400).json({ error: "Falta name" });
    if (!SPREADSHEET_ID) {
      return res
        .status(500)
        .json({ error: "SPREADSHEET_ID no definido en .env" });
    }

    const sheets = await getSheetsClient();
    const range = `${SHEET_SCORECARD}!A:Z`;

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const valuesAll = resp.data.values || [];

    const headerIndex = findHeaderRowIndex(valuesAll, ["Name", "LastName"]);
    if (headerIndex === -1) {
      return res.status(500).json({
        error: `No pude encontrar headers en ${SHEET_SCORECARD}`,
      });
    }

    const values = valuesAll.slice(headerIndex);
    const rows = rowsToObjects(values);

    if (!rows.length) {
      return res.status(404).json({ error: "Score card sin filas" });
    }

    const targetName = norm(name);
    const targetLast = norm(lastName);

    // Match por Name + LastName usando getCell (robusto a headers raros)
    const match = rows.find((r) => {
      const n = norm(getCell(r, ["Name", "name", "nombre"]));
      const l = norm(
        getCell(r, ["LastName", "Last Name", "lastname", "apellido"]),
      );

      if (!targetLast) return n === targetName;
      return n === targetName && l === targetLast;
    });

    if (!match) {
      return res.status(404).json({
        error: "No encontré Score card para ese candidato",
        query: { name, lastName },
      });
    }

    // Construye salida estandarizada (y YA lee EnglishLevel)
    const scorecard = {
      Name: getCell(match, ["Name", "name", "nombre"]),
      LastName: getCell(match, [
        "LastName",
        "Last Name",
        "lastname",
        "apellido",
      ]),
      PreviousCompany: getCell(match, ["PreviousCompany", "Previous Company"]),
      CurrentPastPosition: getCell(match, [
        "CurrentPastPosition",
        "Current/PastPosition",
        "Current Past Position",
      ]),
      PhoneNumber: getCell(match, [
        "PhoneNumber",
        "Phone Number",
        "Telefono",
        "Teléfono",
      ]),
      Motivation: getCell(match, ["Motivation", "Motivación", "Motivacion"]),
      CurrentSalary: getCell(match, [
        "CurrentSalary",
        "Current Salary",
        "SueldoActual",
        "Sueldo Actual",
      ]),
      Benefits: getCell(match, ["Benefits", "Beneficios"]),
      "Salary expectation": getCell(match, [
        "Salary expectation",
        "SalaryExpectation",
        "SalaryExpectation ",
        "Expectativa",
        "Expectativa salarial",
      ]),
      // OJO: en tu Sheet se llama EnglishLevel
      "English Level": getCell(match, [
        "EnglishLevel",
        "English Level",
        "English",
        "Nivel de ingles",
        "Nivel de inglés",
      ]),
    };

    return res.json({ scorecard });
  } catch (err) {
    console.error("SCORECARD ERROR:", err);
    return res.status(500).json({
      error: "Error leyendo Google Sheets (Score card)",
      detail: String(err.message || err),
    });
  }
});

/* -------- DEBUG: posiciones (headers + companies únicas) -------- */
app.get("/debug/positions", async (req, res) => {
  try {
    const sheets = await getSheetsClient();
    const range = `${SHEET_POSICIONES}!A:Z`;

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const valuesAll = resp.data.values || [];
    const headerIndex = findHeaderRowIndex(valuesAll, [
      "ID",
      "company",
      "status",
    ]);

    if (headerIndex === -1) {
      return res.status(500).json({
        error: `No pude encontrar headers en ${SHEET_POSICIONES}`,
      });
    }

    const values = valuesAll.slice(headerIndex);
    const headers = (values[0] || []).map((h) => String(h || "").trim());
    const rows = rowsToObjects(values);

    const sample = rows[0] || {};
    const companyKey =
      findKeyByAliases(sample, ["company", "companyName"]) || "company";

    const companies = Array.from(
      new Set(
        rows.map((r) => String(r[companyKey] || "").trim()).filter((x) => x),
      ),
    ).slice(0, 200);

    res.json({
      headerIndex,
      headers,
      companyKeyDetected: companyKey,
      companies,
      sampleRows: rows.slice(0, 5),
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error debug posiciones",
      detail: String(err.message || err),
    });
  }
});

/* -------- LISTEN EN LAN -------- */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on http://0.0.0.0:${PORT}`);
  console.log(`LAN: http://${LAN_IP}:${PORT}`);
});
