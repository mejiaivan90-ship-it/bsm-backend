// app/(main)/servicios.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

const BLUE = "#0056b8";
const BLUE_DARK = "#002d74";
const BORDER = "#e6e6e6";

// Tu IP actual
import { API_BASE_URL } from "../../confi/api";

type ApiPosition = {
  id: string;
  ID?: string;
  jobId: string;
  owner?: string;
  positionLocation?: string;
  industry?: string;
  status?: string;
  company?: string;
};

type PositionsResponse = {
  companyName: string;
  count: number;
  positions: ApiPosition[];
};

function norm(s: any) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

function safeText(s: any) {
  return String(s || "").trim();
}

function statusKey(status?: string) {
  const s = norm(status);
  if (s === "open") return "open";
  if (s === "on hold" || s === "hold") return "on_hold";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "placement") return "placement";
  return "other";
}

function statusRank(status?: string) {
  const k = statusKey(status);
  if (k === "open") return 1;
  if (k === "on_hold") return 2;
  if (k === "cancelled") return 3;
  if (k === "placement") return 4;
  return 9;
}

function getStatusMeta(status?: string) {
  const k = statusKey(status);
  if (k === "open")
    return {
      label: "Open",
      bg: "#E9F7EE",
      fg: "#0B6E2B",
      border: "#BDE8C8",
      dot: "#17B14B",
    };
  if (k === "cancelled")
    return {
      label: "Cancelled",
      bg: "#FDECEC",
      fg: "#B71C1C",
      border: "#F7C7C7",
      dot: "#D32F2F",
    };
  if (k === "on_hold")
    return {
      label: "On Hold",
      bg: "#FFF7E6",
      fg: "#8A5A00",
      border: "#FFE2A6",
      dot: "#F9A825",
    };
  if (k === "placement")
    return {
      label: "Placement",
      bg: "#F2F2F2",
      fg: "#555",
      border: "#DEDEDE",
      dot: "#6D6D6D",
    };

  return {
    label: status ? safeText(status) : "Pendiente",
    bg: "#EEF4FF",
    fg: BLUE_DARK,
    border: "#DDEBFF",
    dot: BLUE,
  };
}

type SortMode = "status" | "nombre";

export default function ServiciosScreen() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState<string>("");
  const [positions, setPositions] = useState<ApiPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("status");

  // ✅ Habilita LayoutAnimation en Android
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
    const storedUserName = await AsyncStorage.getItem("userName"); // compat
    return (storedCompany || storedUserName || "").trim();
  }, []);

  const fetchPositions = useCallback(async (cn: string) => {
    const url = `${API_BASE_URL}/positions?companyName=${encodeURIComponent(cn)}`;
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
        `No se pudieron cargar posiciones (HTTP ${res.status})`;
      throw new Error(msg);
    }

    return data as PositionsResponse;
  }, []);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      try {
        if (mode === "initial") setLoading(true);
        if (mode === "refresh") setRefreshing(true);

        setErrorMsg("");

        const cn = await loadCompanyName();
        if (!cn) {
          setCompanyName("");
          setPositions([]);
          setErrorMsg(
            "No encontré companyName en sesión. Cierra sesión y vuelve a entrar.",
          );
          return;
        }

        setCompanyName(cn);

        const data = await fetchPositions(cn);
        const list = Array.isArray(data.positions) ? data.positions : [];
        setPositions(list);
      } catch (e: any) {
        const msg =
          e?.message ||
          "Error cargando procesos. Revisa tu conexión y el servidor.";
        setErrorMsg(msg);
        setPositions([]);
        console.log("[SERVICIOS] Error:", msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchPositions, loadCompanyName],
  );

  useEffect(() => {
    load("initial");
  }, [load]);

  const openProceso = (p: ApiPosition) => {
    const title = safeText(p.positionLocation) || "Posición";
    router.push({
      pathname: "/(main)/candidatos",
      params: {
        jobId: p.jobId, // ✅ interno
        positionTitle: title,
        positionName: title, // compat
        companyName: companyName,
      },
    } as any);
  };

  const headerSubtitle = useMemo(() => {
    if (!companyName) return "Aquí puedes consultar el avance de tus servicios";
    return `Empresa: ${companyName}`;
  }, [companyName]);

  // Base filtrada (para que el contador refleje lo que estás viendo)
  const filteredBase = useMemo(() => {
    const q = norm(query);
    if (!q) return positions;

    return positions.filter((p) => {
      const a = norm(p.positionLocation);
      const c = norm(p.industry);
      const d = norm(p.status);
      // ✅ NO buscamos por jobId
      return a.includes(q) || c.includes(q) || d.includes(q);
    });
  }, [positions, query]);

  // Contadores por status (sobre lo filtrado)
  const counts = useMemo(() => {
    const out = { open: 0, on_hold: 0, cancelled: 0, placement: 0, other: 0 };
    for (const p of filteredBase) {
      const k = statusKey(p.status);
      (out as any)[k] = ((out as any)[k] || 0) + 1;
    }
    return out;
  }, [filteredBase]);

  const filteredAndSorted = useMemo(() => {
    const list = [...filteredBase];

    if (sortMode === "nombre") {
      list.sort((x, y) => {
        const ax = safeText(x.positionLocation).toLowerCase();
        const ay = safeText(y.positionLocation).toLowerCase();
        if (ax < ay) return -1;
        if (ax > ay) return 1;
        return (x.jobId || "").localeCompare(y.jobId || "");
      });
      return list;
    }

    // default: status
    list.sort((a, b) => {
      const ra = statusRank(a.status);
      const rb = statusRank(b.status);
      if (ra !== rb) return ra - rb;

      const ax = safeText(a.positionLocation).toLowerCase();
      const bx = safeText(b.positionLocation).toLowerCase();
      if (ax < bx) return -1;
      if (ax > bx) return 1;

      return (a.jobId || "").localeCompare(b.jobId || "");
    });

    return list;
  }, [filteredBase, sortMode]);

  // ✅ anima cuando cambias orden o búsqueda
  useEffect(() => {
    animateUI();
  }, [animateUI, sortMode, query]);

  const StatusPill = ({
    label,
    value,
    status,
  }: {
    label: string;
    value: number;
    status?: string;
  }) => {
    const meta = getStatusMeta(status);
    return (
      <View
        style={[
          styles.countPill,
          { backgroundColor: meta.bg, borderColor: meta.border },
        ]}
      >
        <View style={[styles.countDot, { backgroundColor: meta.dot }]} />
        <Text style={[styles.countLabel, { color: meta.fg }]}>{label}</Text>
        <Text style={[styles.countValue, { color: meta.fg }]}>{value}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerTop}>
        <Text style={styles.title}>Mis procesos</Text>
        <Text style={styles.subtitle}>{headerSubtitle}</Text>
      </View>

      {/* Search + Sort */}
      <View style={styles.controls}>
        <View style={styles.searchWrap}>
          <TextInput
            value={query}
            onChangeText={(t) => setQuery(t)}
            placeholder="Buscar por posición, industria o status..."
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

        {/* Contadores */}
        <View style={styles.countsRow}>
          <StatusPill label="Open" value={counts.open} status="open" />
          <StatusPill label="On Hold" value={counts.on_hold} status="on hold" />
          <StatusPill
            label="Cancelled"
            value={counts.cancelled}
            status="cancelled"
          />
          <StatusPill
            label="Placement"
            value={counts.placement}
            status="placement"
          />
        </View>

        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>Orden:</Text>

          <TouchableOpacity
            style={[
              styles.sortPill,
              sortMode === "status" ? styles.sortPillActive : null,
            ]}
            onPress={() => {
              animateUI();
              setSortMode("status");
            }}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.sortPillText,
                sortMode === "status" ? styles.sortPillTextActive : null,
              ]}
            >
              Status
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sortPill,
              sortMode === "nombre" ? styles.sortPillActive : null,
            ]}
            onPress={() => {
              animateUI();
              setSortMode("nombre");
            }}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.sortPillText,
                sortMode === "nombre" ? styles.sortPillTextActive : null,
              ]}
            >
              Nombre
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={styles.loadingText}>Cargando procesos...</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 18 }}
          data={filteredAndSorted}
          keyExtractor={(item) => item.id || item.jobId}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load("refresh")}
            />
          }
          ListHeaderComponent={
            <>
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

                  <TouchableOpacity
                    style={styles.smallBtn}
                    onPress={() => {
                      Alert.alert(
                        "Servidor",
                        `Asegúrate de que backend esté corriendo en:\n${API_BASE_URL}\n\nY que tu iPhone esté en la misma red.`,
                      );
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.smallBtnText}>Ver tips</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!errorMsg && positions.length === 0 && (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>Sin procesos</Text>
                  <Text style={styles.emptyText}>
                    No encontré posiciones para esta empresa.
                  </Text>
                </View>
              )}
            </>
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            !errorMsg && positions.length > 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>Sin resultados</Text>
                <Text style={styles.emptyText}>
                  Prueba otra búsqueda o cambia el orden.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const title = safeText(item.positionLocation) || "Posición";
            const meta = getStatusMeta(item.status);

            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => openProceso(item)}
                activeOpacity={0.85}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {title}
                    </Text>

                    {/* ✅ Ya NO mostramos Job */}
                    <View style={styles.metaRow}>
                      {!!item.industry && (
                        <Text style={styles.metaText} numberOfLines={1}>
                          {safeText(item.industry)}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: meta.bg, borderColor: meta.border },
                    ]}
                  >
                    <View
                      style={[styles.statusDot, { backgroundColor: meta.dot }]}
                    />
                    <Text style={[styles.statusText, { color: meta.fg }]}>
                      {meta.label}
                    </Text>
                  </View>
                </View>

                <Text style={styles.cardHint}>Toca para ver candidatos</Text>
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.85}
            >
              <Text style={styles.backButtonText}>Regresar</Text>
            </TouchableOpacity>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  headerTop: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: BLUE_DARK,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: "#444",
    textAlign: "center",
  },

  controls: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },

  searchWrap: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
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

  countsRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  countPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  countDot: { width: 8, height: 8, borderRadius: 99 },
  countLabel: { fontSize: 12, fontWeight: "900" },
  countValue: { fontSize: 12, fontWeight: "900" },

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
  sortPillActive: {
    backgroundColor: BLUE_DARK,
    borderColor: BLUE_DARK,
  },
  sortPillText: { fontSize: 12, fontWeight: "900", color: "#111" },
  sortPillTextActive: { color: "#fff" },

  center: { alignItems: "center", marginTop: 30 },
  loadingText: { marginTop: 10, color: "#555", fontWeight: "600" },

  card: {
    borderWidth: 1,
    borderColor: "#DDEBFF",
    backgroundColor: "#F3F7FF",
    borderRadius: 14,
    padding: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: BLUE_DARK,
  },
  metaRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  metaText: { fontSize: 12, color: "#555", fontWeight: "800" },

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

  cardHint: {
    marginTop: 10,
    fontSize: 12,
    color: BLUE,
    fontWeight: "700",
  },

  errorBox: {
    marginTop: 10,
    backgroundColor: "#fff5f5",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#ffd6d6",
    marginBottom: 10,
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

  smallBtn: {
    marginTop: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ffd6d6",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  smallBtnText: { color: "#b71c1c", fontSize: 13, fontWeight: "800" },

  emptyBox: {
    marginTop: 10,
    backgroundColor: "#F3F7FF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#DDEBFF",
  },
  emptyTitle: { fontSize: 14, fontWeight: "900", color: BLUE_DARK },
  emptyText: { marginTop: 6, fontSize: 13, color: "#555", fontWeight: "600" },

  backButton: {
    marginTop: 14,
    backgroundColor: BLUE_DARK,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
});
