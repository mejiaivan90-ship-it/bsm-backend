import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BLUE = "#0056b8";
const BLUE_DARK = "#002d74";
const BORDER = "#e6e6e6";

// ✅ iPhone NO usa localhost
// ✅ IP real PC Wi-Fi
import { API_BASE_URL } from "../../confi/api";

type Position = {
  id: string; // "00210"
  ID: string; // "00210"
  jobId: string; // "Job00210"
  owner: string;
  company: string; // "Value GF"
  positionLocation: string; // título visible
  industry?: string;
  status: string; // "Open"
};

type PositionsResponse = {
  companyName: string;
  count: number;
  positions: Position[];
};

function asString(value: string | string[] | undefined) {
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
}

function enc(v: string) {
  return encodeURIComponent(v ?? "");
}

export default function PosicionesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // ✅ params desde servicios.tsx
  const jobIdParam = asString(params.jobId as any); // "Job00210"
  const positionTitleParam = asString(params.positionTitle as any);
  const companyNameParam = asString(params.companyName as any);

  const [query, setQuery] = useState("");
  const [companyName, setCompanyName] = useState(companyNameParam || "");
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const singlePositionMode = useMemo(() => !!jobIdParam, [jobIdParam]);

  const fetchPositions = async (cn: string) => {
    const url = `${API_BASE_URL}/positions?companyName=${encodeURIComponent(cn)}`;
    const res = await fetch(url);
    const text = await res.text();
    const data = text ? (JSON.parse(text) as PositionsResponse) : null;

    if (!res.ok) {
      const msg =
        (data as any)?.error ||
        (data as any)?.detail ||
        `No se pudieron cargar posiciones (HTTP ${res.status})`;
      throw new Error(msg);
    }

    return data as PositionsResponse;
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setErrorMsg("");

        // 1) Si viene jobId: mostramos una tarjeta “detalle” sin pedir lista
        if (jobIdParam) {
          const p: Position = {
            id: jobIdParam,
            ID: jobIdParam,
            jobId: jobIdParam,
            owner: "",
            company: companyNameParam || companyName || "",
            positionLocation: positionTitleParam || "Posición",
            industry: "",
            status: "Open",
          };
          setCompanyName(companyNameParam || companyName || "");
          setPositions([p]);
          return;
        }

        // 2) Si no viene jobId: cargamos lista real por companyName
        let cn = (companyNameParam || "").trim();
        if (!cn) {
          const stored = await AsyncStorage.getItem("companyName");
          cn = String(stored || "").trim();
        }

        if (!cn) {
          setCompanyName("");
          setPositions([]);
          setErrorMsg(
            "No encontré companyName. Cierra sesión y vuelve a entrar.",
          );
          return;
        }

        setCompanyName(cn);

        const data = await fetchPositions(cn);
        setPositions(Array.isArray(data?.positions) ? data.positions : []);
      } catch (e: any) {
        const msg = e?.message || "Error cargando posiciones.";
        setErrorMsg(msg);
        setPositions([]);
        console.log("[POSICIONES] Error:", msg);
      } finally {
        setLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = async () => {
    if (singlePositionMode) return;
    try {
      setRefreshing(true);
      setErrorMsg("");

      const cn = (companyName || "").trim();
      const data = await fetchPositions(cn);
      setPositions(Array.isArray(data?.positions) ? data.positions : []);
    } catch (e: any) {
      const msg = e?.message || "Error refrescando posiciones.";
      setErrorMsg(msg);
      setPositions([]);
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return positions;

    return positions.filter((p) => {
      const title = (p.positionLocation || "").toLowerCase();
      const job = (p.jobId || "").toLowerCase();
      const st = (p.status || "").toLowerCase();
      const ind = (p.industry || "").toLowerCase();
      return (
        title.includes(q) ||
        job.includes(q) ||
        st.includes(q) ||
        ind.includes(q)
      );
    });
  }, [positions, query]);

  const goCandidatos = (p: Position) => {
    const title = (p.positionLocation || "").trim() || "Posición";
    const cn = (p.company || companyName || "").trim();

    const url =
      `/(main)/candidatos` +
      `?jobId=${enc(p.jobId)}` +
      `&positionTitle=${enc(title)}` +
      `&companyName=${enc(cn)}`;

    router.push(url as any);
  };

  const headerSubtitle = useMemo(() => {
    if (singlePositionMode) return "Detalle de posición";
    if (companyName) return `Empresa: ${companyName}`;
    return "Selecciona una posición";
  }, [companyName, singlePositionMode]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Posiciones</Text>
          <Text style={styles.subtitle}>{headerSubtitle}</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por título / job / status..."
          placeholderTextColor="#777"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => setQuery("")}
            style={styles.clearBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.clearText}>Limpiar</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          data={filtered}
          keyExtractor={(item) => item.id || item.jobId || item.ID}
          refreshControl={
            singlePositionMode ? undefined : (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            )
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListHeaderComponent={
            <>
              {!!errorMsg && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorTitle}>No se pudo cargar</Text>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              )}
              <View style={{ height: 8 }} />
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>Sin posiciones</Text>
              <Text style={styles.emptySub}>
                Prueba otra búsqueda o regresa.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => goCandidatos(item)}
              activeOpacity={0.85}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.positionLocation || "Posición"}
                </Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.status || "Open"}</Text>
                </View>
              </View>

              <Text style={styles.cardSub}>
                Job: {item.jobId}
                {item.industry ? ` · ${item.industry}` : ""}
              </Text>

              <Text style={styles.cardHint}>Toca para ver candidatos</Text>
            </TouchableOpacity>
          )}
        />
      )}
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
  backText: { fontSize: 18, fontWeight: "800", color: "#111" },
  title: { fontSize: 18, fontWeight: "900", color: BLUE_DARK },
  subtitle: { marginTop: 2, fontSize: 12, color: "#444" },

  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
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
  clearText: { fontSize: 12, fontWeight: "800", color: "#111" },

  center: { alignItems: "center", marginTop: 30 },
  loadingText: { marginTop: 10, color: "#555", fontWeight: "600" },

  errorBox: {
    backgroundColor: "#fff5f5",
    borderRadius: 14,
    padding: 12,
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

  card: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: "900", color: BLUE_DARK, flex: 1 },
  cardSub: { marginTop: 6, fontSize: 13, color: "#333" },
  cardHint: { marginTop: 6, fontSize: 12, color: BLUE },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#E8F1FF",
  },
  badgeText: { fontSize: 12, fontWeight: "900", color: BLUE_DARK },

  emptyWrap: { paddingHorizontal: 16, paddingTop: 24, alignItems: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "900", color: BLUE_DARK },
  emptySub: { marginTop: 6, fontSize: 13, color: "#555", textAlign: "center" },
});
