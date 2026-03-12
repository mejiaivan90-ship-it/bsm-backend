import cors from "cors";
import express from "express";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

app.get("/", (req, res) => {
  res.json({ status: "API funcionando" });
});

app.post("/auth/login", (req, res) => {
  const { email, password } = req.body;

  // DEMO LOGIN (solo para probar)
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
