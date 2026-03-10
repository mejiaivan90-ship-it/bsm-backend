// app/(main)/candidatos.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL } from "../../confi/api";

type Candidato = {
  id: string;
  nombre: string;
  etapa: string; // currentStage real
  status: string; // STATUS (Placement o vacío)
  score: number; // 0-100
  raw?: any;
};

const BLUE = "#0056b8";
const BLUE_DARK = "#002d74";
const NAVY = "#0b1f4a";
const BORDER = "#e6e6e6";
const CARD_BG = "#F3F7FF";
const CARD_BORDER = "#DDEBFF";

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

function toScore(raw: any) {
  const s = pick(raw, [
    "Score 1-100",
    "Score",
    "score",
    "Puntaje",
    "Rating",
    "Calificación",
  ]);
  const n = Number(String(s || "").replace(/[^\d.]/g, ""));
  if (Number.isFinite(n) && n > 0) return Math.max(0, Math.min(100, n));
  return 0;
}

function etapaKey(etapa: string) {
  const e = safeText(etapa).toUpperCase();
  if (e === "RCCA") return "RCCA";
  if (e === "RIWH") return "RIWH";
  if (e === "RCVS") return "RCVS";
  if (e === "RCNL") return "RCNL";
  if (e === "PLACEMENT") return "PLACEMENT";
  return "OTRA";
}

function clientStageKeyFromCandidate(etapa: string, status: string) {
  const e = safeText(etapa).toUpperCase();
  const s = norm(status);

  if (s === "placement" || e === "PLACEMENT") return "PLACEMENT";
  if (e === "RCNL") return "RCNL";
  if (e === "RCVS") return "RCVS";
  if (e === "RIWH" || e === "RCCA") return "BUSQUEDA";
  return "BUSQUEDA";
}

function clientStageMeta(stage: string) {
  if (stage === "PLACEMENT") {
    return {
      label: "Posición cubierta",
      desc: "La posición ha sido cubierta exitosamente.",
      step: 4,
      accent: "#5B5BD6",
      bg: "#EEF0FF",
      border: "#D9DDFF",
      fg: "#2B2F77",
    };
  }

  if (stage === "RCNL") {
    return {
      label: "Entrevista con cliente",
      desc: "El proceso se encuentra en evaluación directa con cliente.",
      step: 3,
      accent: "#8E24AA",
      bg: "#F6EAFB",
      border: "#E7C8F2",
      fg: "#5A1570",
    };
  }

  if (stage === "RCVS") {
    return {
      label: "Perfiles enviados",
      desc: "Hemos compartido perfiles alineados con la posición para tu revisión.",
      step: 2,
      accent: "#F2A100",
      bg: "#FFF6E5",
      border: "#FFE2A6",
      fg: "#8A5A00",
    };
  }

  return {
    label: "Búsqueda en curso",
    desc: "Estamos identificando y evaluando perfiles alineados a la posición.",
    step: 1,
    accent: "#0056b8",
    bg: "#EAF2FF",
    border: "#D6E6FF",
    fg: "#002D74",
  };
}

function isVisibleToClient(c: Candidato) {
  const stage = clientStageKeyFromCandidate(c.etapa, c.status);
  return stage === "RCVS" || stage === "RCNL" || stage === "PLACEMENT";
}

function candidateClientStageMeta(etapa: string, status: string) {
  const stage = clientStageKeyFromCandidate(etapa, status);

  if (stage === "PLACEMENT") {
    return {
      label: "Posición cubierta",
      bg: "#EEF0FF",
      fg: "#2B2F77",
      border: "#D9DDFF",
      accent: "#5B5BD6",
    };
  }

  if (stage === "RCNL") {
    return {
      label: "Entrevista con cliente",
      bg: "#F6EAFB",
      fg: "#5A1570",
      border: "#E7C8F2",
      accent: "#8E24AA",
    };
  }

  return {
    label: "Perfiles enviados",
    bg: "#FFF6E5",
    fg: "#8A5A00",
    border: "#FFE2A6",
    accent: "#F2A100",
  };
}

function statusMeta(status: string) {
  const s = norm(status);
  if (s === "placement") {
    return {
      label: "Placement",
      bg: "#F2F2F2",
      fg: "#555",
      border: "#DEDEDE",
      dot: "#6D6D6D",
    };
  }
  if (!s || s === "—") {
    return {
      label: "Activo",
      bg: "#EEF4FF",
      fg: BLUE_DARK,
      border: CARD_BORDER,
      dot: BLUE,
    };
  }
  return {
    label: safeText(status),
    bg: "#FFF7E6",
    fg: "#8A5A00",
    border: "#FFE2A6",
    dot: "#F9A825",
  };
}

function scoreMeta(score: number) {
  if (score >= 85) {
    return { bg: "#E9F7EE", fg: "#0B6E2B", bar: "#17B14B", label: "Muy alto" };
  }
  if (score >= 70) {
    return { bg: "#EEF4FF", fg: BLUE_DARK, bar: BLUE, label: "Bueno" };
  }
  if (score >= 55) {
    return { bg: "#FFF7E6", fg: "#8A5A00", bar: "#F9A825", label: "Medio" };
  }
  if (score > 0) {
    return { bg: "#FDECEC", fg: "#B71C1C", bar: "#D32F2F", label: "Bajo" };
  }
  return { bg: "#F2F2F2", fg: "#666", bar: "#BDBDBD", label: "—" };
}

type CandidatesResponse = {
  jobId: string;
  count: number;
  candidates: Array<{
    id: string;
    jobId: string;
    name: string;
    firstName?: string;
    lastName?: string;
    status?: string;
    currentStage?: string;
    RCCA?: string;
    RIWH?: string;
    RCVS?: string;
    RCNL?: string;
    [k: string]: any;
  }>;
};

type SortMode = "score" | "nombre" | "etapa";

export default function CandidatosScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const jobId = asString(params.jobId as any);
  const positionTitle = asString(params.positionTitle as any);
  const companyNameParam = asString(params.companyName as any);

  const [companyName, setCompanyName] = useState(companyNameParam || "");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("score");

  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (Platform.OS === "android") {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  const animateUI = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, []);

  const loadCompanyName = useCallback(async () => {
    const storedCompany = await AsyncStorage.getItem("companyName");
    return String(storedCompany || "").trim();
  }, []);

  const fetchCandidates = useCallback(async (jid: string) => {
    const url = `${API_BASE_URL}/candidates?jobId=${encodeURIComponent(jid)}`;
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
        `No se pudieron cargar candidatos (HTTP ${res.status})`;
      throw new Error(msg);
    }

    return data as CandidatesResponse;
  }, []);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      try {
        if (!jobId) {
          setErrorMsg(
            "No llegó el proceso. Regresa y selecciona una posición.",
          );
          setCandidatos([]);
          setLoading(false);
          return;
        }

        if (mode === "initial") setLoading(true);
        if (mode === "refresh") setRefreshing(true);

        setErrorMsg("");

        if (!companyName) {
          const cn = await loadCompanyName();
          if (cn) setCompanyName(cn);
        }

        const data = await fetchCandidates(jobId);

        const mapped: Candidato[] = (data?.candidates || []).map((c, idx) => {
          const raw = c || {};
          const nombre = safeText(c.name) || "Candidato";
          const etapa = safeText(c.currentStage) || "—";
          const status = safeText(c.status) || "—";
          const score = toScore(raw);

          return {
            id: c.id || `${jobId}_${idx + 1}`,
            nombre,
            etapa,
            status,
            score,
            raw,
          };
        });

        setCandidatos(mapped);
      } catch (e: any) {
        const msg =
          e?.message ||
          "Error cargando candidatos. Revisa tu conexión y el servidor.";
        setErrorMsg(msg);
        setCandidatos([]);
        console.log("[CANDIDATOS] Error:", msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyName, fetchCandidates, jobId, loadCompanyName],
  );

  useEffect(() => {
    load("initial");
  }, [load]);

  useEffect(() => {
    animateUI();
  }, [animateUI, sortMode, query]);

  const processStage = useMemo(() => {
    let hasRCVS = false;
    let hasRCNL = false;
    let hasPlacement = false;

    for (const c of candidatos) {
      const stage = clientStageKeyFromCandidate(c.etapa, c.status);
      if (stage === "PLACEMENT") hasPlacement = true;
      else if (stage === "RCNL") hasRCNL = true;
      else if (stage === "RCVS") hasRCVS = true;
    }

    if (hasPlacement) return "PLACEMENT";
    if (hasRCNL) return "RCNL";
    if (hasRCVS) return "RCVS";
    return "BUSQUEDA";
  }, [candidatos]);

  const processMeta = useMemo(
    () => clientStageMeta(processStage),
    [processStage],
  );

  const canShowCandidates = useMemo(() => {
    return (
      processStage === "RCVS" ||
      processStage === "RCNL" ||
      processStage === "PLACEMENT"
    );
  }, [processStage]);

  const visibleCandidates = useMemo(() => {
    if (!canShowCandidates) return [];
    return candidatos.filter(isVisibleToClient);
  }, [candidatos, canShowCandidates]);

  const filteredBase = useMemo(() => {
    const base = canShowCandidates ? visibleCandidates : [];
    const q = norm(query);

    if (!q) return base;

    return base.filter((c) => {
      const a = norm(c.nombre);
      const b = norm(candidateClientStageMeta(c.etapa, c.status).label);
      const s = norm(c.status);
      return a.includes(q) || b.includes(q) || s.includes(q);
    });
  }, [canShowCandidates, query, visibleCandidates]);

  const counts = useMemo(() => {
    const out = {
      enviados: 0,
      entrevista: 0,
      cubierta: 0,
    };

    for (const c of visibleCandidates) {
      const stage = clientStageKeyFromCandidate(c.etapa, c.status);
      if (stage === "RCVS") out.enviados += 1;
      if (stage === "RCNL") out.entrevista += 1;
      if (stage === "PLACEMENT") out.cubierta += 1;
    }

    return out;
  }, [visibleCandidates]);

  const filteredAndSorted = useMemo(() => {
    const list = [...filteredBase];

    if (sortMode === "nombre") {
      list.sort((a, b) => a.nombre.localeCompare(b.nombre));
      return list;
    }

    if (sortMode === "etapa") {
      const rank = (c: Candidato) => {
        const k = clientStageKeyFromCandidate(c.etapa, c.status);
        if (k === "RCVS") return 1;
        if (k === "RCNL") return 2;
        if (k === "PLACEMENT") return 3;
        return 9;
      };

      list.sort((a, b) => {
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return ra - rb;
        return b.score - a.score;
      });
      return list;
    }

    list.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.nombre.localeCompare(b.nombre);
    });
    return list;
  }, [filteredBase, sortMode]);

  const openDetalle = async (c: Candidato) => {
    try {
      await AsyncStorage.setItem(
        "selectedCandidateRaw",
        JSON.stringify(c.raw || {}),
      );
    } catch {}

    const translatedStage = candidateClientStageMeta(c.etapa, c.status).label;

    router.push({
      pathname: "/(main)/candidato",
      params: {
        candidatoId: c.id,
        candidatoNombre: c.nombre,
        candidatoEtapa: translatedStage,
        candidatoStatus: c.status,
        candidatoScore: String(c.score || 0),
        companyName: companyName || "",
        positionTitle: positionTitle || "",
        jobId: jobId || "",
      },
    } as any);
  };

  const subtitle = useMemo(() => {
    const left = positionTitle ? positionTitle : "Candidatos";
    const right = companyName ? ` · ${companyName}` : "";
    return `${left}${right}`;
  }, [companyName, positionTitle]);

  const ProgressStep = ({
    label,
    index,
    currentStep,
  }: {
    label: string;
    index: number;
    currentStep: number;
  }) => {
    const isDone = index < currentStep;
    const isCurrent = index === currentStep;

    return (
      <View style={styles.progressItem}>
        <View
          style={[
            styles.progressDot,
            isDone ? styles.progressDotDone : null,
            isCurrent ? styles.progressDotCurrent : null,
          ]}
        >
          <Text
            style={[
              styles.progressDotText,
              isDone || isCurrent ? styles.progressDotTextActive : null,
            ]}
          >
            {isDone ? "✓" : index}
          </Text>
        </View>

        <Text
          style={[
            styles.progressLabel,
            isDone || isCurrent ? styles.progressLabelActive : null,
          ]}
        >
          {label}
        </Text>
      </View>
    );
  };

  const StagePill = ({ label, value }: { label: string; value: number }) => (
    <View style={styles.countPill}>
      <Text style={styles.countLabel}>{label}</Text>
      <Text style={styles.countValue}>{value}</Text>
    </View>
  );

  const SortPill = ({
    label,
    active,
    onPress,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={[styles.sortPill, active ? styles.sortPillActive : null]}
      onPress={() => {
        animateUI();
        onPress();
      }}
      activeOpacity={0.85}
    >
      <Text
        style={[styles.sortPillText, active ? styles.sortPillTextActive : null]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

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
          <Text style={styles.title}>Proceso</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      <FlatList
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        data={loading ? [] : filteredAndSorted}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load("refresh")}
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListHeaderComponent={
          <>
            <View style={styles.trackerCard}>
              <View style={styles.trackerTop}>
                <View
                  style={[
                    styles.trackerBadge,
                    {
                      backgroundColor: processMeta.bg,
                      borderColor: processMeta.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.trackerBadgeText, { color: processMeta.fg }]}
                  >
                    {processMeta.label}
                  </Text>
                </View>
              </View>

              <Text style={styles.trackerTitle}>Seguimiento del proceso</Text>
              <Text style={styles.trackerDesc}>{processMeta.desc}</Text>

              <View style={styles.progressWrap}>
                <ProgressStep
                  label="Búsqueda en curso"
                  index={1}
                  currentStep={processMeta.step}
                />
                <ProgressStep
                  label="Perfiles enviados"
                  index={2}
                  currentStep={processMeta.step}
                />
                <ProgressStep
                  label="Entrevista con cliente"
                  index={3}
                  currentStep={processMeta.step}
                />
                <ProgressStep
                  label="Posición cubierta"
                  index={4}
                  currentStep={processMeta.step}
                />
              </View>
            </View>

            {!!errorMsg && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>No se pudo cargar</Text>
                <Text style={styles.errorText}>{errorMsg}</Text>

                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => load("initial")}
                  activeOpacity={0.85}
                >
                  <Text style={styles.retryBtnText}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            )}

            {!loading && !errorMsg && !canShowCandidates && (
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>Seguimiento activo</Text>
                <Text style={styles.infoText}>
                  El detalle de candidatos se habilitará cuando la posición
                  avance a una etapa visible para cliente.
                </Text>
              </View>
            )}

            {!loading && !errorMsg && canShowCandidates && (
              <>
                <View style={styles.controls}>
                  <View style={styles.searchWrap}>
                    <TextInput
                      value={query}
                      onChangeText={setQuery}
                      placeholder="Buscar por nombre, etapa o status..."
                      placeholderTextColor="#777"
                      style={styles.searchInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {query.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setQuery("")}
                        style={styles.clearBtn}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.clearText}>Limpiar</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.countsRow}>
                    <StagePill
                      label="Perfiles enviados"
                      value={counts.enviados}
                    />
                    <StagePill
                      label="Entrevista con cliente"
                      value={counts.entrevista}
                    />
                    <StagePill
                      label="Posición cubierta"
                      value={counts.cubierta}
                    />
                  </View>

                  <View style={styles.sortRow}>
                    <Text style={styles.sortLabel}>Orden:</Text>
                    <SortPill
                      label="Score"
                      active={sortMode === "score"}
                      onPress={() => setSortMode("score")}
                    />
                    <SortPill
                      label="Nombre"
                      active={sortMode === "nombre"}
                      onPress={() => setSortMode("nombre")}
                    />
                    <SortPill
                      label="Etapa"
                      active={sortMode === "etapa"}
                      onPress={() => setSortMode("etapa")}
                    />
                  </View>
                </View>

                <View style={styles.countRow}>
                  <Text style={styles.countText}>
                    {filteredAndSorted.length} candidato(s)
                  </Text>
                </View>
              </>
            )}

            {!loading &&
              !errorMsg &&
              canShowCandidates &&
              filteredAndSorted.length === 0 && (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>Sin candidatos visibles</Text>
                  <Text style={styles.emptyText}>
                    Aún no hay candidatos disponibles para esta etapa del
                    proceso.
                  </Text>
                </View>
              )}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={BLUE} />
              <Text style={styles.loadingText}>Cargando proceso...</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const stage = candidateClientStageMeta(item.etapa, item.status);
          const st = statusMeta(item.status);
          const sc = scoreMeta(item.score);
          const pct = Math.max(0, Math.min(100, item.score || 0));

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => openDetalle(item)}
              activeOpacity={0.85}
            >
              <View
                style={[styles.accentBar, { backgroundColor: stage.accent }]}
              />

              <View style={{ flex: 1 }}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.nombre}
                  </Text>

                  <View
                    style={[
                      styles.pill,
                      {
                        backgroundColor: stage.bg,
                        borderColor: stage.border,
                      },
                    ]}
                  >
                    <Text style={[styles.pillText, { color: stage.fg }]}>
                      {stage.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.rowBetween}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: st.bg, borderColor: st.border },
                    ]}
                  >
                    <View
                      style={[styles.statusDot, { backgroundColor: st.dot }]}
                    />
                    <Text style={[styles.statusText, { color: st.fg }]}>
                      {st.label}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.scorePill,
                      { backgroundColor: sc.bg, borderColor: CARD_BORDER },
                    ]}
                  >
                    <Text style={[styles.scorePillText, { color: sc.fg }]}>
                      Score {item.score || 0} ({sc.label})
                    </Text>
                  </View>
                </View>

                <View style={styles.scoreBarWrap}>
                  <View style={styles.scoreBarBg}>
                    <View
                      style={[
                        styles.scoreBarFill,
                        { width: `${pct}%`, backgroundColor: sc.bar },
                      ]}
                    />
                  </View>
                </View>

                <Text style={styles.cardHint}>Toca para ver detalle</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

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

  trackerCard: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 16,
  },
  trackerTop: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  trackerBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  trackerBadgeText: {
    fontSize: 12,
    fontWeight: "900",
  },
  trackerTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "900",
    color: NAVY,
  },
  trackerDesc: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: "#475569",
    fontWeight: "600",
  },

  progressWrap: {
    marginTop: 16,
    gap: 12,
  },
  progressItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  progressDotDone: {
    backgroundColor: NAVY,
    borderColor: NAVY,
  },
  progressDotCurrent: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  progressDotText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#64748B",
  },
  progressDotTextActive: {
    color: "#fff",
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
    flex: 1,
  },
  progressLabelActive: {
    color: "#0F172A",
    fontWeight: "900",
  },

  infoCard: {
    marginTop: 12,
    backgroundColor: "#EEF5FF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(0,86,184,0.16)",
    padding: 14,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: BLUE_DARK,
  },
  infoText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: "#334155",
    fontWeight: "600",
  },

  controls: {
    paddingTop: 14,
    paddingBottom: 8,
  },

  searchWrap: { flexDirection: "row", gap: 10, alignItems: "center" },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#111",
    backgroundColor: "#fff",
  },
  clearBtn: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f4f4",
  },
  clearText: { fontSize: 12, fontWeight: "900", color: "#111" },

  countsRow: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  countPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,86,184,0.14)",
    backgroundColor: "#EEF5FF",
  },
  countLabel: { fontSize: 12, fontWeight: "900", color: BLUE_DARK },
  countValue: { fontSize: 12, fontWeight: "900", color: BLUE_DARK },

  sortRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sortLabel: { fontSize: 12, fontWeight: "900", color: "#333" },
  sortPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#fff",
  },
  sortPillActive: { backgroundColor: BLUE_DARK, borderColor: BLUE_DARK },
  sortPillText: { fontSize: 12, fontWeight: "900", color: "#111" },
  sortPillTextActive: { color: "#fff" },

  center: { alignItems: "center", marginTop: 30 },
  loadingText: { marginTop: 10, color: "#555", fontWeight: "600" },

  countRow: { marginTop: 8, marginBottom: 10 },
  countText: { fontSize: 12, color: "#666", fontWeight: "800" },

  card: {
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    gap: 12,
  },
  accentBar: {
    width: 6,
    borderRadius: 999,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "900", color: BLUE_DARK, flex: 1 },

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontSize: 12, fontWeight: "900" },

  rowBetween: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusDot: { width: 8, height: 8, borderRadius: 99 },
  statusText: { fontSize: 12, fontWeight: "900" },

  scorePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  scorePillText: { fontSize: 12, fontWeight: "900" },

  scoreBarWrap: { marginTop: 10 },
  scoreBarBg: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: "hidden",
  },
  scoreBarFill: { height: 10, borderRadius: 999 },

  cardHint: { marginTop: 10, fontSize: 12, color: BLUE, fontWeight: "700" },

  errorBox: {
    marginTop: 12,
    backgroundColor: "#fff5f5",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#ffd6d6",
  },
  errorTitle: { fontSize: 14, fontWeight: "900", color: "#b71c1c" },
  errorText: {
    marginTop: 6,
    fontSize: 13,
    color: "#7a1b1b",
    fontWeight: "600",
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: BLUE_DARK,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  retryBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },

  emptyBox: {
    marginTop: 10,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  emptyTitle: { fontSize: 14, fontWeight: "900", color: BLUE_DARK },
  emptyText: { marginTop: 6, fontSize: 13, color: "#555", fontWeight: "600" },
});
