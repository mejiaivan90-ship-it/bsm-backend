// app/(main)/candidato.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL } from "../../confi/api";

const BLUE = "#0056b8";
const BLUE_DARK = "#002d74";
const BORDER = "#e6e6e6";
const CARD_BG = "#F3F7FF";
const CARD_BORDER = "#DDEBFF";
const NAVY = "#0b1f4a";

// Cache scorecard
const SCORECACHE_TTL_MS = 5 * 60 * 1000; // 5 min

function asString(value: string | string[] | undefined) {
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
}

function safeText(s: any) {
  return String(s || "").trim();
}

function norm(s: any) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

function pick(obj: any, keys: string[]) {
  for (const k of keys) {
    if (obj && obj[k] != null && String(obj[k]).trim() !== "") {
      return String(obj[k]).trim();
    }
  }
  return "";
}

function cleanUrl(u: string) {
  const url = (u || "").trim();
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
}

function stageMetaFromClientLabel(label: string) {
  const l = safeText(label).toLowerCase();

  if (l === "posición cubierta") {
    return {
      bg: "#EEF0FF",
      fg: "#2B2F77",
      accent: "#5B5BD6",
      border: "#D9DDFF",
    };
  }

  if (l === "entrevista con cliente") {
    return {
      bg: "#F6EAFB",
      fg: "#5A1570",
      accent: "#8E24AA",
      border: "#E7C8F2",
    };
  }

  if (l === "perfiles enviados") {
    return {
      bg: "#FFF6E5",
      fg: "#8A5A00",
      accent: "#F2A100",
      border: "#FFE2A6",
    };
  }

  return {
    bg: "#EAF2FF",
    fg: "#002D74",
    accent: "#0056b8",
    border: "#D6E6FF",
  };
}

function clientStatusLabel(status: string) {
  const s = norm(status);
  if (s === "placement") return "Placement";
  if (!s || s === "—") return "Activo";
  return safeText(status);
}

type ScorecardApi = {
  Name?: string;
  LastName?: string;
  PreviousCompany?: string;
  CurrentPastPosition?: string;
  PhoneNumber?: string;
  Motivation?: string;
  CurrentSalary?: string;
  Benefits?: string;
  "Salary expectation"?: string;
  "English Level"?: string;
  LinkedIn?: string;
  Linkedin?: string;
  phoneNumber?: string;
  englishLevel?: string;
  linkedin?: string;
  currentSalary?: string;
  salaryExpectation?: string;
  Skills?: string;
  skills?: string;
};

export default function CandidatoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const candidatoId = asString(params.candidatoId as any);
  const candidatoNombreParam = asString(params.candidatoNombre as any);
  const candidatoEtapaParam = asString(params.candidatoEtapa as any);
  const candidatoStatusParam = asString(params.candidatoStatus as any);
  const candidatoScoreParam = asString(params.candidatoScore as any);

  const companyName = asString(params.companyName as any);
  const positionTitle = asString(params.positionTitle as any);
  const positionNameCompat = asString(params.positionName as any);

  const headerPosition = positionTitle || positionNameCompat || "Candidato";

  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState<any>(null);

  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreError, setScoreError] = useState("");
  const [scorecard, setScorecard] = useState<ScorecardApi | null>(null);

  useEffect(() => {
    const loadRaw = async () => {
      try {
        const rawStr = await AsyncStorage.getItem("selectedCandidateRaw");
        setRaw(rawStr ? JSON.parse(rawStr) : null);
      } catch {
        setRaw(null);
      }
    };
    loadRaw();
  }, []);

  const firstName = useMemo(() => {
    const fromRaw =
      pick(raw, ["firstName", "First Name", "Name", "Nombre"]) ||
      pick(raw, ["name"]);
    const fallback = (candidatoNombreParam || "").trim().split(" ")[0] || "";
    return (fromRaw || fallback).trim();
  }, [raw, candidatoNombreParam]);

  const lastName = useMemo(() => {
    const fromRaw =
      pick(raw, ["lastName", "Last Name", "LastName", "Apellido"]) || "";
    const parts = (candidatoNombreParam || "")
      .trim()
      .split(" ")
      .filter(Boolean);
    const fallback = parts.length > 1 ? parts.slice(1).join(" ") : "";
    return (fromRaw || fallback).trim();
  }, [raw, candidatoNombreParam]);

  const scoreCacheKey = useMemo(() => {
    const a = norm(firstName || "noname");
    const b = norm(lastName || "nolast");
    return `scorecard_${a}_${b}_v2`;
  }, [firstName, lastName]);

  useEffect(() => {
    const loadCache = async () => {
      try {
        const str = await AsyncStorage.getItem(scoreCacheKey);
        if (!str) return;
        const parsed = JSON.parse(str);
        if (!parsed?.ts || !parsed?.data) return;

        const fresh = Date.now() - Number(parsed.ts) <= SCORECACHE_TTL_MS;
        if (fresh) setScorecard(parsed.data);
      } catch {
        // ignore
      }
    };
    loadCache();
  }, [scoreCacheKey]);

  const fetchScorecard = useCallback(
    async (mode: "auto" | "manual" = "auto") => {
      if (!firstName) {
        if (mode === "manual") {
          setScoreError("No tengo el nombre para buscar Score card.");
        }
        setLoading(false);
        return;
      }

      setScoreLoading(true);
      setScoreError("");

      try {
        const url = `${API_BASE_URL}/scorecard?name=${encodeURIComponent(
          firstName,
        )}&lastName=${encodeURIComponent(lastName || "")}`;

        const res = await fetch(url);
        const text = await res.text();

        let data: any = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = null;
        }

        if (!res.ok) {
          const msg =
            data?.error ||
            data?.detail ||
            `No pude cargar Score card (HTTP ${res.status})`;
          throw new Error(msg);
        }

        const sc = (data?.scorecard || data?.data || data) as ScorecardApi;

        setScorecard(sc);

        await AsyncStorage.setItem(
          scoreCacheKey,
          JSON.stringify({ ts: Date.now(), data: sc }),
        );
      } catch (e: any) {
        setScoreError(e?.message || "Error cargando Score card");
      } finally {
        setScoreLoading(false);
        setLoading(false);
      }
    },
    [firstName, lastName, scoreCacheKey],
  );

  useEffect(() => {
    fetchScorecard("auto");
  }, [fetchScorecard]);

  const fullName = useMemo(() => {
    if (!raw) return candidatoNombreParam || "Sin nombre";

    const nameDirect = pick(raw, ["name", "Name"]);
    const first = pick(raw, ["firstName", "First Name", "Nombre", "Name"]);
    const last = pick(raw, ["lastName", "Last Name", "Apellido", "LastName"]);
    const composed = [first, last].filter(Boolean).join(" ").trim();

    return nameDirect || composed || candidatoNombreParam || "Sin nombre";
  }, [raw, candidatoNombreParam]);

  // ✅ YA NO usamos currentStage crudo desde raw para mostrar al cliente
  const etapa = useMemo(() => {
    return candidatoEtapaParam || "—";
  }, [candidatoEtapaParam]);

  const status = useMemo(() => {
    const fromRaw = raw ? pick(raw, ["status", "STATUS", "Estatus"]) : "";
    return fromRaw || candidatoStatusParam || "—";
  }, [raw, candidatoStatusParam]);

  const statusLabel = useMemo(() => {
    return clientStatusLabel(status);
  }, [status]);

  const scoreNum = useMemo(() => {
    const fromParam = Number(candidatoScoreParam || "");
    if (Number.isFinite(fromParam)) return fromParam;
    return 0;
  }, [candidatoScoreParam]);

  const scoreMeta = useMemo(() => {
    if (scoreNum >= 85) {
      return {
        bg: "#E8F5E9",
        fg: "#1B5E20",
        bar: "#17B14B",
        label: "Muy alto",
      };
    }
    if (scoreNum >= 70) {
      return { bg: "#E3F2FD", fg: "#0D47A1", bar: "#1E88E5", label: "Bueno" };
    }
    if (scoreNum >= 55) {
      return { bg: "#FFF3E0", fg: "#8A5A00", bar: "#F9A825", label: "Medio" };
    }
    if (scoreNum > 0) {
      return { bg: "#FDECEC", fg: "#B71C1C", bar: "#D32F2F", label: "Bajo" };
    }
    return { bg: "#F2F2F2", fg: "#666", bar: "#BDBDBD", label: "—" };
  }, [scoreNum]);

  const etapaMeta = useMemo(() => {
    return stageMetaFromClientLabel(etapa);
  }, [etapa]);

  const statusMeta = useMemo(() => {
    const s = norm(statusLabel);
    if (s === "placement") {
      return { bg: "#F2F2F2", fg: "#555", dot: "#6D6D6D" };
    }
    if (!s || s === "—" || s === "activo") {
      return { bg: "#EEF4FF", fg: BLUE_DARK, dot: BLUE };
    }
    return { bg: "#FFF7E6", fg: "#8A5A00", dot: "#F9A825" };
  }, [statusLabel]);

  const sc = useMemo(() => {
    const s = scorecard || {};
    return {
      telefono: pick(s, ["PhoneNumber", "phoneNumber", "Telefono", "Teléfono"]),
      linkedin: pick(s, ["LinkedIn", "Linkedin", "linkedin"]),
      ingles: pick(s, ["EnglishLevel", "English Level", "englishLevel"]),
      skills: pick(s, ["Skills", "skills"]),

      sueldoActual: pick(s, [
        "CurrentSalary",
        "currentSalary",
        "Sueldo Actual",
      ]),
      expectativa: pick(s, [
        "Salary expectation",
        "salaryExpectation",
        "SalaryExpectation",
        "Expectativa Salarial",
      ]),
      beneficios: pick(s, ["Benefits", "benefits", "Beneficios"]),
      motivacion: pick(s, ["Motivation", "motivation", "Motivación"]),

      empresaAnterior: pick(s, ["PreviousCompany", "previousCompany"]),
      posicionActual: pick(s, ["CurrentPastPosition", "currentPastPosition"]),
    };
  }, [scorecard]);

  const rawInfo = useMemo(() => {
    if (!raw) {
      return {
        telefono: "",
        ubicacion: "",
        empresa: "",
        posicionActual: "",
        motivacion: "",
        sueldoActual: "",
        expectativa: "",
        ingles: "",
        linkedin: "",
        comentarios: "",
      };
    }

    return {
      telefono: pick(raw, ["Télefono", "Teléfono", "Telefono", "Phone"]),
      ubicacion: pick(raw, ["Ubicación", "Ubicacion", "Location", "Ciudad"]),
      empresa: pick(raw, ["Empresa", "Company", "company"]),
      posicionActual: pick(raw, [
        "Posición Actual/Last",
        "Posicion Actual/Last",
        "Posición actual",
        "Current Position",
      ]),
      motivacion: pick(raw, ["Motivación", "Motivacion"]),
      sueldoActual: pick(raw, ["Sueldo Actual", "Sueldo", "Current Salary"]),
      expectativa: pick(raw, [
        "Expectativa Salarial",
        "Expectativa",
        "Expected Salary",
      ]),
      ingles: pick(raw, ["EnglishLevel", "Nivel de inglés", "English Level"]),
      linkedin: pick(raw, ["LinkedIn", "Linkedin"]),
      comentarios: pick(raw, [
        "Comentario cliente",
        "Comments",
        "CommentRCCA",
        "IVNOTE/coments RIWH",
      ]),
    };
  }, [raw]);

  const telefonoFinal = sc.telefono || rawInfo.telefono || "—";
  const linkedinFinal = sc.linkedin || rawInfo.linkedin || "";
  const inglesFinal = sc.ingles || rawInfo.ingles || "—";
  const skillsFinal = sc.skills || "—";

  const sueldoFinal = sc.sueldoActual || rawInfo.sueldoActual || "—";
  const expectativaFinal = sc.expectativa || rawInfo.expectativa || "—";
  const beneficiosFinal = sc.beneficios || "—";
  const motivacionFinal = sc.motivacion || rawInfo.motivacion || "—";

  const posicionFinal = sc.posicionActual || rawInfo.posicionActual || "—";
  const empresaFinal =
    sc.empresaAnterior || rawInfo.empresa || companyName || "—";

  const openLinkedIn = async () => {
    const url = cleanUrl(linkedinFinal);
    if (!url) return;
    const can = await Linking.canOpenURL(url);
    if (can) Linking.openURL(url);
  };

  const refreshScore = async () => {
    await fetchScorecard("manual");
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={BLUE} />
        <Text style={styles.loadingText}>Cargando detalle...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.85}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Detalle</Text>
          <Text style={styles.subtitle}>
            {headerPosition}
            {companyName ? ` · ${companyName}` : ""}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 22 }}
        refreshControl={
          <RefreshControl refreshing={scoreLoading} onRefresh={refreshScore} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topCard}>
          <View
            style={[styles.accentBarTop, { backgroundColor: etapaMeta.accent }]}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{fullName}</Text>

            <View style={styles.row}>
              <View
                style={[
                  styles.pill,
                  {
                    backgroundColor: etapaMeta.bg,
                    borderColor: etapaMeta.border,
                  },
                ]}
              >
                <Text style={[styles.pillText, { color: etapaMeta.fg }]}>
                  {etapa || "—"}
                </Text>
              </View>

              <View
                style={[styles.pillRow, { backgroundColor: statusMeta.bg }]}
              >
                <View
                  style={[styles.dot, { backgroundColor: statusMeta.dot }]}
                />
                <Text style={[styles.pillText, { color: statusMeta.fg }]}>
                  {statusLabel || "—"}
                </Text>
              </View>

              <View
                style={[
                  styles.pill,
                  { backgroundColor: scoreMeta.bg, borderColor: CARD_BORDER },
                ]}
              >
                <Text style={[styles.pillText, { color: scoreMeta.fg }]}>
                  Score {scoreNum || 0} ({scoreMeta.label})
                </Text>
              </View>
            </View>

            <View style={styles.scoreBarBg}>
              <View
                style={[
                  styles.scoreBarFill,
                  {
                    width: `${Math.max(0, Math.min(100, scoreNum || 0))}%`,
                    backgroundColor: scoreMeta.bar,
                  },
                ]}
              />
            </View>

            <View style={styles.scoreBar}>
              <Text style={styles.scoreBarText}>
                {scoreLoading
                  ? "Cargando Score card..."
                  : scorecard
                    ? "Score card conectado"
                    : "Sin Score card"}
              </Text>

              <TouchableOpacity
                onPress={refreshScore}
                activeOpacity={0.85}
                style={styles.refreshBtn}
              >
                <Text style={styles.refreshBtnText}>
                  {scoreLoading ? "..." : "Actualizar"}
                </Text>
              </TouchableOpacity>
            </View>

            {!!scoreError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>
                  No se pudo cargar Score card
                </Text>
                <Text style={styles.errorText}>{scoreError}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <View style={[styles.accentBar, { backgroundColor: "#1E88E5" }]} />
          <View style={{ flex: 1 }}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionTitle}>Contacto</Text>
              {!!linkedinFinal && (
                <TouchableOpacity onPress={openLinkedIn} activeOpacity={0.85}>
                  <Text style={styles.linkBtn}>Abrir LinkedIn</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.grid}>
              <View style={styles.kpi}>
                <Text style={styles.kpiLabel}>Teléfono</Text>
                <Text style={styles.kpiValue}>{telefonoFinal}</Text>
              </View>

              <View style={styles.kpi}>
                <Text style={styles.kpiLabel}>Inglés</Text>
                <Text style={styles.kpiValue}>{inglesFinal || "—"}</Text>
              </View>
            </View>

            {!!linkedinFinal && (
              <Text style={styles.smallUrl} numberOfLines={2}>
                {linkedinFinal}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <View style={[styles.accentBar, { backgroundColor: "#F9A825" }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Compensación</Text>

            <View style={styles.grid}>
              <View style={styles.kpi}>
                <Text style={styles.kpiLabel}>Sueldo actual</Text>
                <Text style={styles.kpiValue}>{sueldoFinal}</Text>
              </View>

              <View style={styles.kpi}>
                <Text style={styles.kpiLabel}>Expectativa</Text>
                <Text style={styles.kpiValue}>{expectativaFinal}</Text>
              </View>
            </View>

            <View style={styles.hr} />

            <Text style={styles.subTitle}>Beneficios</Text>
            <Text style={styles.textBlock}>{beneficiosFinal}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={[styles.accentBar, { backgroundColor: "#8E24AA" }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Experiencia</Text>

            <Text style={styles.line}>
              Posición actual:{" "}
              <Text style={styles.strong}>{posicionFinal}</Text>
            </Text>
            <Text style={styles.line}>
              Empresa: <Text style={styles.strong}>{empresaFinal}</Text>
            </Text>

            <View style={styles.hr} />

            <Text style={styles.subTitle}>Motivación</Text>
            <Text style={styles.textBlock}>{motivacionFinal}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={[styles.accentBar, { backgroundColor: "#17B14B" }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <Text style={styles.textBlock}>{skillsFinal}</Text>
          </View>
        </View>

        {!!rawInfo.comentarios && (
          <View style={styles.card}>
            <View style={[styles.accentBar, { backgroundColor: "#6D6D6D" }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Comentarios</Text>
              <Text style={styles.textBlock}>{rawInfo.comentarios}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.footerBack}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Text style={styles.footerBackText}>Volver</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, color: "#555", fontWeight: "700" },

  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f4f4",
  },
  backText: { fontSize: 18, fontWeight: "900", color: "#111" },
  title: { fontSize: 18, fontWeight: "900", color: BLUE_DARK },
  subtitle: { marginTop: 2, fontSize: 12, color: "#444" },

  topCard: {
    marginTop: 14,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    padding: 14,
    backgroundColor: CARD_BG,
    flexDirection: "row",
    gap: 12,
  },
  accentBarTop: { width: 6, borderRadius: 999 },
  name: { fontSize: 18, fontWeight: "900", color: BLUE_DARK },

  row: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: "#fff",
  },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  dot: { width: 8, height: 8, borderRadius: 99 },
  pillText: { fontSize: 12, fontWeight: "900" },

  scoreBarBg: {
    marginTop: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: "hidden",
  },
  scoreBarFill: { height: 10, borderRadius: 999 },

  scoreBar: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  scoreBarText: { fontSize: 12, fontWeight: "900", color: "#111" },
  refreshBtn: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: BLUE_DARK,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshBtnText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  errorBox: {
    marginTop: 10,
    backgroundColor: "#fff5f5",
    borderWidth: 1,
    borderColor: "#ffd6d6",
    borderRadius: 14,
    padding: 10,
  },
  errorTitle: { fontSize: 12, fontWeight: "900", color: "#b71c1c" },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: "#7a1b1b",
    fontWeight: "700",
  },

  card: {
    marginTop: 12,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    padding: 14,
    backgroundColor: CARD_BG,
    flexDirection: "row",
    gap: 12,
  },
  accentBar: { width: 6, borderRadius: 999 },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  sectionTitle: { fontSize: 13, fontWeight: "900", color: BLUE_DARK },
  subTitle: { marginTop: 2, fontSize: 12, fontWeight: "900", color: "#111" },
  linkBtn: { fontSize: 12, fontWeight: "900", color: BLUE },

  grid: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kpi: {
    width: "48%",
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 10,
  },
  kpiLabel: { fontSize: 11, color: "#334", fontWeight: "800" },
  kpiValue: { marginTop: 4, fontSize: 13, color: "#111", fontWeight: "900" },

  hr: { height: 1, backgroundColor: CARD_BORDER, marginVertical: 12 },
  line: { fontSize: 13, color: "#333", marginBottom: 6 },
  strong: { fontWeight: "900", color: "#111" },

  textBlock: { marginTop: 6, fontSize: 13, color: "#333", fontWeight: "700" },

  smallUrl: { marginTop: 10, fontSize: 12, color: "#333", fontWeight: "700" },

  footerBack: {
    marginTop: 14,
    marginHorizontal: 16,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BLUE_DARK,
  },
  footerBackText: { color: "#fff", fontSize: 14, fontWeight: "900" },
});
