// app/(main)/perfil.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import NewsletterPreview from "../../components/NewsletterPreview";
import WeeklyHighlight from "../../components/WeeklyHighlight";

// Paleta (misma línea)
const BLUE = "#0056b8";
const BLUE_DARK = "#002d74";
const NAVY = "#0b1f4a";
const BG = "#f6f8fc";
const CARD_BORDER = "rgba(15,23,42,0.08)";

// ✅ RESPETAR ESTE IMPORT
import { API_BASE_URL } from "../../confi/api";

// Cache
const CACHE_KEY = "perfilResumenCache_v5";
const CACHE_TTL_MS = 5 * 60 * 1000;

const { width: SCREEN_W } = Dimensions.get("window");
const DRAWER_W = Math.min(320, Math.round(SCREEN_W * 0.82));
const DRAWER_TOP_GAP = 10;

const LOCAL_LOGO = require("../../assets/LOGO.png");

type PositionApi = {
  jobId?: string;
  status?: string;
};

type PositionsResponse = {
  companyName: string;
  count: number;
  positions: PositionApi[];
};

type CandidatesResponse = {
  jobId: string;
  count: number;
  candidates: any[];
};

function norm(s: any) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

// Concurrencia simple
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;

  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}

function formatNowMx() {
  try {
    return new Date().toLocaleString("es-MX", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function PerfilScreen() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState<string>("");
  const [userName, setUserName] = useState<string | null>(null);

  const [logoUrl, setLogoUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Debug
  const [debugOpen, setDebugOpen] = useState(false);
  const [imageError, setImageError] = useState<string>("");

  // Resumen
  const [resumen, setResumen] = useState({
    posicionesAbiertas: 0,
    candidatosEnEntrevista: 0,
    open: 0,
    onHold: 0,
    cancelled: 0,
    placement: 0,
  });
  const [resumenLoading, setResumenLoading] = useState(false);

  const isSvg = useMemo(() => {
    const u = (logoUrl || "").toLowerCase().trim();
    return u.endsWith(".svg") || u.includes(".svg?");
  }, [logoUrl]);

  const logoSource = useMemo(() => {
    const u = (logoUrl || "").trim();
    if (u && u.startsWith("http") && !isSvg) return { uri: u };
    return LOCAL_LOGO;
  }, [logoUrl, isSvg]);

  const cacheKeyForCompany = useMemo(() => {
    const cn = (companyName || "").trim() || "no_company";
    return `${CACHE_KEY}_${cn}`;
  }, [companyName]);

  const nowLabel = useMemo(() => formatNowMx(), []);

  const openStorageAlert = async () => {
    const kv = await AsyncStorage.multiGet([
      "userToken",
      "companyName",
      "userName",
      "logoUrl",
      "userEmail",
      cacheKeyForCompany,
    ]);

    const obj: Record<string, string> = {};
    kv.forEach(([k, v]) => (obj[k] = v ?? ""));

    Alert.alert(
      "AsyncStorage (debug)",
      `userToken: ${obj.userToken ? "(existe)" : "(vacío)"}\n` +
        `companyName: ${obj.companyName}\n` +
        `userName: ${obj.userName}\n` +
        `logoUrl: ${obj.logoUrl}\n` +
        `userEmail: ${obj.userEmail}\n\n` +
        `cache(${cacheKeyForCompany}): ${
          obj[cacheKeyForCompany] ? "(existe)" : "(vacío)"
        }`,
    );
  };

  const handleLogout = async () => {
    try {
      setMenuOpen(false);

      // limpiar UI local inmediatamente
      setCompanyName("");
      setUserName("");
      setLogoUrl("");
      setImageError("");
      setResumen({
        posicionesAbiertas: 0,
        candidatosEnEntrevista: 0,
        open: 0,
        onHold: 0,
        cancelled: 0,
        placement: 0,
      });

      const allKeys = await AsyncStorage.getAllKeys();

      const keysToRemove = allKeys.filter((k) => {
        return (
          k === "userToken" ||
          k === "userName" ||
          k === "companyName" ||
          k === "logoUrl" ||
          k === "userEmail" ||
          k === "selectedCandidateRaw" ||
          k.startsWith("perfilResumenCache_v5") ||
          k.startsWith("scorecard_")
        );
      });

      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }

      router.replace("/(auth)/login");
    } catch {
      router.replace("/(auth)/login");
    }
  };

  const goMisProcesos = () => {
    setMenuOpen(false);
    router.push("/(main)/servicios");
  };

  // Fetch helpers
  async function fetchPositions(cn: string): Promise<PositionApi[]> {
    const url = `${API_BASE_URL}/positions?companyName=${encodeURIComponent(
      cn,
    )}`;
    const res = await fetch(url);
    const data = (await res
      .json()
      .catch(() => null)) as PositionsResponse | null;
    if (!res.ok) return [];
    return Array.isArray(data?.positions) ? data!.positions : [];
  }

  async function fetchCandidatesCount(jobId: string): Promise<number> {
    const url = `${API_BASE_URL}/candidates?jobId=${encodeURIComponent(jobId)}`;
    const res = await fetch(url);
    const data = (await res
      .json()
      .catch(() => null)) as CandidatesResponse | null;
    if (!res.ok) return 0;

    if (typeof data?.count === "number") return data.count;
    const arr = Array.isArray(data?.candidates) ? data!.candidates : [];
    return arr.length;
  }

  // Cache helpers
  async function readCache() {
    try {
      const str = await AsyncStorage.getItem(cacheKeyForCompany);
      if (!str) return null;
      const parsed = JSON.parse(str);

      if (!parsed?.ts || Date.now() - Number(parsed.ts) > CACHE_TTL_MS)
        return null;

      const keys = [
        "posicionesAbiertas",
        "candidatosEnEntrevista",
        "open",
        "onHold",
        "cancelled",
        "placement",
      ] as const;

      for (const k of keys) {
        if (typeof parsed[k] !== "number") return null;
      }

      return {
        posicionesAbiertas: parsed.posicionesAbiertas,
        candidatosEnEntrevista: parsed.candidatosEnEntrevista,
        open: parsed.open,
        onHold: parsed.onHold,
        cancelled: parsed.cancelled,
        placement: parsed.placement,
      };
    } catch {
      return null;
    }
  }

  async function writeCache(data: any) {
    try {
      await AsyncStorage.setItem(
        cacheKeyForCompany,
        JSON.stringify({
          ts: Date.now(),
          ...data,
        }),
      );
    } catch {
      // ignore
    }
  }

  // Core resumen
  async function loadResumenReal(cn: string, force = false) {
    if (!cn) return;

    setResumenLoading(true);
    try {
      if (!force) {
        const cached = await readCache();
        if (cached) {
          setResumen(cached);
          return;
        }
      }

      const positions = await fetchPositions(cn);

      const openPositionsAll = positions.filter(
        (p) => norm(p?.status) === "open",
      );
      const onHoldPositions = positions.filter((p) => {
        const s = norm(p?.status);
        return s === "on hold" || s === "hold";
      });
      const cancelledPositions = positions.filter((p) => {
        const s = norm(p?.status);
        return s === "cancelled" || s === "canceled";
      });
      const placementPositions = positions.filter(
        (p) => norm(p?.status) === "placement",
      );

      const openPositions = openPositionsAll.filter(
        (p) => String(p?.jobId || "").trim() !== "",
      );

      const jobIds = openPositions
        .map((p) => String(p.jobId || "").trim())
        .filter(Boolean);

      const counts = await mapWithConcurrency(jobIds, 4, async (jid) => {
        const n = await fetchCandidatesCount(jid);
        return Number.isFinite(n) ? n : 0;
      });

      const totalCandidates = counts.reduce((a, b) => a + (b || 0), 0);

      const computed = {
        posicionesAbiertas: openPositions.length,
        candidatosEnEntrevista: totalCandidates,
        open: openPositionsAll.length,
        onHold: onHoldPositions.length,
        cancelled: cancelledPositions.length,
        placement: placementPositions.length,
      };

      setResumen(computed);
      await writeCache(computed);
    } catch (e: any) {
      console.log("[PERFIL] Error resumen:", e?.message || e);
    } finally {
      setResumenLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    const load = async () => {
      try {
        // reset visual primero para evitar arrastre de otra empresa
        setLoading(true);
        setCompanyName("");
        setUserName("");
        setLogoUrl("");
        setImageError("");
        setResumen({
          posicionesAbiertas: 0,
          candidatosEnEntrevista: 0,
          open: 0,
          onHold: 0,
          cancelled: 0,
          placement: 0,
        });

        const storedCompany = await AsyncStorage.getItem("companyName");
        const storedName = await AsyncStorage.getItem("userName");
        const storedLogo = await AsyncStorage.getItem("logoUrl");

        const cn = (storedCompany || storedName || "").trim();
        const displayName =
          (storedName || storedCompany || "BSM Consulting")
            .trim()
            .toUpperCase() === (cn || "").trim().toUpperCase()
            ? (cn || "BSM Consulting").trim()
            : (storedName || cn || "BSM Consulting").trim();

        setCompanyName(cn);
        setUserName(displayName);
        setLogoUrl((storedLogo || "").trim());

        if (cn) {
          await loadResumenReal(cn, false);
        }
      } catch (e: any) {
        console.log("[PERFIL] Error leyendo AsyncStorage:", e?.message || e);
        setCompanyName("");
        setUserName("");
        setLogoUrl("");
        setResumen({
          posicionesAbiertas: 0,
          candidatosEnEntrevista: 0,
          open: 0,
          onHold: 0,
          cancelled: 0,
          placement: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const proximasAcciones = useMemo(
    () => [
      {
        id: "a1",
        title: "Revisar candidatos en entrevista",
        meta: `${resumen.candidatosEnEntrevista} candidatos`,
      },
      {
        id: "a2",
        title: "Validar shortlist con cliente",
        meta: "Revisa candidatos por posición",
      },
      {
        id: "a3",
        title: "Ver mis procesos",
        meta: `${resumen.posicionesAbiertas} posiciones abiertas`,
      },
    ],
    [resumen.candidatosEnEntrevista, resumen.posicionesAbiertas],
  );

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      if (companyName) await loadResumenReal(companyName, true);
    } finally {
      setRefreshing(false);
    }
  };

  const tapRefresh = () => {
    if (!companyName) return;
    loadResumenReal(companyName, true);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={BLUE} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Drawer */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <View style={styles.drawerWrap}>
          <Pressable
            style={styles.drawerOverlay}
            onPress={() => setMenuOpen(false)}
          >
            <View />
          </Pressable>

          <SafeAreaView style={[styles.drawerSafe, { width: DRAWER_W }]}>
            <View style={styles.drawerTopGap} />

            <View style={styles.drawerPanelInner}>
              {/* Premium header */}
              <View style={styles.drawerHeaderPremium}>
                <View style={styles.drawerHeaderRow}>
                  <View style={styles.drawerAvatarWrapPremium}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onLongPress={() => setDebugOpen((v) => !v)}
                      delayLongPress={350}
                    >
                      <Image
                        source={logoSource}
                        style={styles.drawerAvatarPremium}
                        resizeMode="contain"
                        onError={(e) => {
                          const msg =
                            (e as any)?.nativeEvent?.error ||
                            "Error cargando imagen";
                          setImageError(msg);
                          setLogoUrl("");
                        }}
                        onLoad={() => setImageError("")}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.drawerHelloPremium}>Tu cuenta</Text>
                    <Text style={styles.drawerNamePremium} numberOfLines={1}>
                      {userName}
                    </Text>
                    <Text style={styles.drawerSubPremium} numberOfLines={1}>
                      {companyName
                        ? `Empresa: ${companyName}`
                        : "Sesión activa"}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => setMenuOpen(false)}
                    style={styles.drawerCloseBtnPremium}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="close" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>

                <View style={styles.drawerStatsPremium}>
                  <View style={styles.drawerStatItem}>
                    <Text style={styles.drawerStatValuePremium}>
                      {resumenLoading ? "…" : resumen.posicionesAbiertas}
                    </Text>
                    <Text style={styles.drawerStatLabelPremium}>
                      Posiciones abiertas
                    </Text>
                  </View>

                  <View style={styles.drawerStatDividerPremium} />

                  <View style={styles.drawerStatItem}>
                    <Text style={styles.drawerStatValuePremium}>
                      {resumenLoading ? "…" : resumen.candidatosEnEntrevista}
                    </Text>
                    <Text style={styles.drawerStatLabelPremium}>
                      En entrevista
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.refreshResumenBtnPremium}
                  onPress={tapRefresh}
                  activeOpacity={0.85}
                  disabled={!companyName}
                >
                  <Ionicons
                    name="refresh"
                    size={16}
                    color="#fff"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.refreshResumenTextPremium}>
                    {resumenLoading ? "Actualizando..." : "Actualizar resumen"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Notices */}
              {logoUrl && isSvg && (
                <View style={styles.noticeBox}>
                  <Text style={styles.noticeTitle}>Logo en formato SVG</Text>
                  <Text style={styles.noticeText}>
                    iPhone no renderiza SVG con &lt;Image&gt;. Por eso se usa el
                    logo local. Recomendado: cambia el link del Sheet a PNG/JPG.
                  </Text>
                </View>
              )}

              {!!imageError && (
                <View
                  style={[
                    styles.noticeBox,
                    { backgroundColor: "#fff5f5", borderColor: "#ffd6d6" },
                  ]}
                >
                  <Text style={[styles.noticeTitle, { color: "#d32f2f" }]}>
                    Error cargando logo
                  </Text>
                  <Text
                    style={[styles.noticeText, { color: "#b71c1c" }]}
                    numberOfLines={3}
                  >
                    {imageError}
                  </Text>
                </View>
              )}

              {debugOpen && (
                <View style={styles.debugBox}>
                  <Text style={styles.debugTitle}>
                    DEBUG (long press al logo)
                  </Text>
                  <Text style={styles.debugLine}>
                    <Text style={styles.debugLabel}>companyName:</Text>{" "}
                    {companyName || "—"}
                  </Text>
                  <Text style={styles.debugLine}>
                    <Text style={styles.debugLabel}>userName:</Text>{" "}
                    {userName || "—"}
                  </Text>
                  <Text style={styles.debugLine}>
                    <Text style={styles.debugLabel}>logoUrl:</Text>{" "}
                    {logoUrl || "—"}
                  </Text>
                  <Text style={styles.debugLine}>
                    <Text style={styles.debugLabel}>es SVG?:</Text>{" "}
                    {isSvg ? "Sí" : "No"}
                  </Text>
                  <TouchableOpacity
                    style={styles.debugBtn}
                    onPress={openStorageAlert}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.debugBtnText}>
                      Ver AsyncStorage (alert)
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Actions */}
              <View style={{ marginTop: 14 }}>
                <Text style={styles.drawerSectionTitle}>Acciones</Text>

                <TouchableOpacity
                  style={styles.drawerItemPremium}
                  onPress={goMisProcesos}
                  activeOpacity={0.85}
                >
                  <View style={styles.drawerItemIcon}>
                    <Ionicons name="briefcase-outline" size={18} color="#fff" />
                  </View>
                  <Text style={styles.drawerItemTextPremium}>Mis procesos</Text>
                  <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.drawerItemPremium, styles.drawerItemDanger]}
                  onPress={handleLogout}
                  activeOpacity={0.85}
                >
                  <View
                    style={[styles.drawerItemIcon, styles.drawerItemIconRed]}
                  >
                    <Ionicons name="log-out-outline" size={18} color="#fff" />
                  </View>
                  <Text
                    style={[styles.drawerItemTextPremium, { color: "#fecaca" }]}
                  >
                    Cerrar sesión
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#fecaca" />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* HERO (APP3-style) */}
        <View style={styles.hero}>
          {/* decor */}
          <View style={styles.heroGlowA} />
          <View style={styles.heroGlowB} />

          {/* avatar flotante */}
          <View style={styles.heroAvatarFloat}>
            <TouchableOpacity
              activeOpacity={0.9}
              onLongPress={() => setDebugOpen((v) => !v)}
              delayLongPress={350}
            >
              <Image
                source={logoSource}
                style={styles.heroAvatarImg}
                resizeMode="contain"
                onError={(e) => {
                  const msg =
                    (e as any)?.nativeEvent?.error || "Error cargando imagen";
                  setImageError(msg);
                  setLogoUrl("");
                }}
                onLoad={() => setImageError("")}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => setMenuOpen(true)}
            style={styles.heroMenuBtn}
            activeOpacity={0.85}
          >
            <Ionicons name="menu" size={18} color="#fff" />
          </TouchableOpacity>

          <View style={styles.heroText}>
            <Text style={styles.heroOverline}>Bienvenido</Text>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {userName}
            </Text>
            <Text style={styles.heroSubtitle} numberOfLines={1}>
              {nowLabel ? nowLabel : "Sesión activa"}
            </Text>
          </View>

          {!!imageError && (
            <View style={styles.heroNoticeError}>
              <Text style={styles.heroNoticeTitle}>Error cargando logo</Text>
              <Text style={styles.heroNoticeText} numberOfLines={2}>
                {imageError}
              </Text>
            </View>
          )}
        </View>

        {/* DASHBOARD */}
        <View style={styles.wrap}>
          {/* KPIs (simplificados) */}
          <View style={styles.kpiRow}>
            <View style={styles.kpiCardClean}>
              <Text style={styles.kpiNumClean}>
                {resumenLoading ? "…" : resumen.posicionesAbiertas}
              </Text>
              <Text style={styles.kpiTitleClean}>Posiciones abiertas</Text>
              <Text style={styles.kpiMetaClean}>
                {resumenLoading
                  ? "—"
                  : `${resumen.posicionesAbiertas} abiertas`}
              </Text>
            </View>

            <View style={styles.kpiCardClean}>
              <View style={styles.kpiTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kpiNumClean}>
                    {resumenLoading ? "…" : resumen.candidatosEnEntrevista}
                  </Text>
                  <Text style={styles.kpiTitleClean}>
                    Candidatos en entrevista
                  </Text>
                  <Text style={styles.kpiMetaClean}>
                    {resumenLoading
                      ? "—"
                      : `${resumen.candidatosEnEntrevista} candidatos`}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={tapRefresh}
                  activeOpacity={0.85}
                  style={styles.kpiIconBtn}
                  disabled={!companyName}
                >
                  <Ionicons name="refresh" size={16} color="#0f172a" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Estado de procesos (filas tipo imagen) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Estado de procesos</Text>
              <Text style={styles.cardSub}>
                Toca un estado para ver detalle
              </Text>
            </View>

            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={[styles.statusRow, styles.statusOpen]}
                onPress={goMisProcesos}
                activeOpacity={0.85}
              >
                <Text style={styles.statusCount}>
                  {resumenLoading ? "…" : resumen.open}
                </Text>
                <Text style={styles.statusLabel}>Open</Text>
                <View style={styles.statusChevronPill}>
                  <Ionicons name="chevron-forward" size={18} color="#0f172a" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusRow, styles.statusHold]}
                onPress={goMisProcesos}
                activeOpacity={0.85}
              >
                <Text style={styles.statusCount}>
                  {resumenLoading ? "…" : resumen.onHold}
                </Text>
                <Text style={styles.statusLabel}>On Hold</Text>
                <View style={styles.statusChevronPill}>
                  <Ionicons name="chevron-forward" size={18} color="#0f172a" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusRow, styles.statusCancel]}
                onPress={goMisProcesos}
                activeOpacity={0.85}
              >
                <Text style={styles.statusCount}>
                  {resumenLoading ? "…" : resumen.cancelled}
                </Text>
                <Text style={styles.statusLabel}>Canceled</Text>
                <View style={styles.statusChevronPill}>
                  <Ionicons name="chevron-forward" size={18} color="#0f172a" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusRow, styles.statusPlace]}
                onPress={goMisProcesos}
                activeOpacity={0.85}
              >
                <Text style={styles.statusCount}>
                  {resumenLoading ? "…" : resumen.placement}
                </Text>
                <Text style={styles.statusLabel}>Placement</Text>
                <View style={styles.statusChevronPill}>
                  <Ionicons name="chevron-forward" size={18} color="#0f172a" />
                </View>
              </TouchableOpacity>
            </View>

            {!companyName ? (
              <View style={styles.warnBox}>
                <Text style={styles.warnTitle}>Sesión incompleta</Text>
                <Text style={styles.warnText}>
                  No encontré companyName. Cierra sesión y vuelve a entrar.
                </Text>
              </View>
            ) : null}
          </View>

          {/* Próximas acciones (pills tipo imagen) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Próximas acciones</Text>
              <Text style={styles.cardSub}>Recomendaciones para hoy</Text>
            </View>

            <View style={{ gap: 12 }}>
              {proximasAcciones.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={styles.nextActionPill}
                  onPress={goMisProcesos}
                  activeOpacity={0.85}
                >
                  <View style={styles.nextActionIconCircle}>
                    <Ionicons name="chevron-forward" size={18} color={NAVY} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.nextActionTitle}>{a.title}</Text>
                    <Text style={styles.nextActionMeta}>{a.meta}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* NEWSLETTER */}
        <View style={styles.section}>
          <View style={styles.sectionBody}>
            <NewsletterPreview />
          </View>
        </View>

        {/* INSPIRACIÓN (estilo como imagen) */}
        <View style={styles.section}>
          <View style={styles.inspoHeader}>
            <Text style={styles.inspoTitle}>Inspiración de la semana</Text>
            <View style={styles.inspoPillWrap}>
              <Text style={styles.inspoPill}>MINDSET</Text>
            </View>
          </View>

          <View style={styles.inspoShell}>
            <View style={styles.inspoBlueBox}>
              <Text style={styles.inspoQuote}>
                “El talento gana partidos, pero el trabajo en equipo gana
                campeones.”
              </Text>
              <Text style={styles.inspoAuthor}>– Michael Jordan</Text>
            </View>
          </View>

          {/* Mantengo import y componente para no romper nada si lo usas en otra parte */}
          <View style={{ height: 0, overflow: "hidden" }}>
            <WeeklyHighlight content="" author="" />
          </View>
        </View>

        <View style={{ height: 22 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { justifyContent: "center", alignItems: "center" },

  // HERO (APP3)
  hero: {
    marginTop: 10,
    marginHorizontal: 16,
    borderRadius: 24,
    backgroundColor: NAVY,
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 18,
    overflow: "hidden",
  },
  heroGlowA: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    right: -90,
    top: -120,
  },
  heroGlowB: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(0,86,184,0.18)",
    left: -90,
    bottom: -110,
  },
  heroAvatarFloat: {
    position: "absolute",
    left: 18,
    top: 16,
    width: 76,
    height: 76,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  heroAvatarImg: { width: 74, height: 74 },
  heroMenuBtn: {
    position: "absolute",
    right: 14,
    top: 14,
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: {
    marginLeft: 92,
    paddingRight: 44,
    minHeight: 78,
    justifyContent: "center",
  },
  heroOverline: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 13,
    fontWeight: "800",
  },
  heroTitle: { color: "#fff", fontSize: 21, fontWeight: "900", marginTop: 3 },
  heroSubtitle: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 5,
  },

  heroNoticeError: {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  heroNoticeTitle: { color: "#fff", fontSize: 12, fontWeight: "900" },
  heroNoticeText: {
    marginTop: 4,
    color: "rgba(255,255,255,0.86)",
    fontSize: 12,
    fontWeight: "600",
  },

  // layout
  wrap: { marginTop: 12, marginHorizontal: 16, gap: 12 },

  // KPIs (simplificados)
  kpiRow: { flexDirection: "row", gap: 12 },
  kpiCardClean: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: CARD_BORDER,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    padding: 16,
    minHeight: 112,
    justifyContent: "center",
  },
  kpiTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  kpiNumClean: { fontSize: 32, fontWeight: "900", color: "#0f172a" },
  kpiTitleClean: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "900",
    color: "#0f172a",
  },
  kpiMetaClean: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
  },
  kpiIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },

  // cards
  card: {
    borderRadius: 22,
    backgroundColor: "#fff",
    padding: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: "900", color: "#0f172a" },
  cardSub: { fontSize: 12, fontWeight: "700", color: "#64748b" },

  warnBox: {
    marginTop: 12,
    backgroundColor: "#fff5f5",
    borderWidth: 1,
    borderColor: "#ffd6d6",
    borderRadius: 16,
    padding: 10,
  },
  warnTitle: { fontSize: 12, fontWeight: "900", color: "#b71c1c" },
  warnText: { marginTop: 4, fontSize: 12, color: "#7a1b1b", fontWeight: "700" },

  // Estado de procesos (filas)
  statusRow: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  statusCount: {
    width: 34,
    fontSize: 22,
    fontWeight: "900",
    color: "#0f172a",
  },
  statusLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    fontStyle: "italic",
    marginLeft: 6,
  },
  statusChevronPill: {
    width: 44,
    height: 34,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusOpen: {
    backgroundColor: "rgba(34,197,94,0.18)", // verde premium (tinte)
    borderColor: "rgba(34,197,94,0.28)",
  },
  statusHold: {
    backgroundColor: "rgba(245,158,11,0.18)", // ámbar premium
    borderColor: "rgba(245,158,11,0.30)",
  },
  statusCancel: {
    backgroundColor: "rgba(239,68,68,0.16)", // rojo premium
    borderColor: "rgba(239,68,68,0.28)",
  },
  statusPlace: {
    backgroundColor: "#060bff47", // índigo premium
    borderColor: "#060bff47",
  },

  // Próximas acciones (pills)
  nextActionPill: {
    minHeight: 58,
    borderRadius: 22,
    backgroundColor: NAVY,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  nextActionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  nextActionTitle: { fontSize: 14, fontWeight: "900", color: "#fff" },
  nextActionMeta: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.80)",
  },

  // sections
  section: { marginTop: 14, marginHorizontal: 16 },

  sectionBody: {
    marginTop: 10,
    backgroundColor: "#eef5ff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(0,86,184,0.18)",
    padding: 10,
  },

  // INSPIRACIÓN (nuevo estilo)
  inspoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  inspoTitle: { fontSize: 16, fontWeight: "900", color: "#0f172a" },
  inspoPillWrap: { borderRadius: 999, overflow: "hidden" },
  inspoPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#e9ecff",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.18)",
    fontSize: 11,
    fontWeight: "900",
    color: "#2b2f77",
  },
  inspoShell: {
    marginTop: 10,
    borderRadius: 22,
    backgroundColor: "#eef0ff",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    padding: 12,
  },
  inspoBlueBox: {
    borderRadius: 18,
    backgroundColor: "#1495db",
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
  },
  inspoQuote: {
    textAlign: "center",
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },
  inspoAuthor: {
    marginTop: 14,
    color: "rgba(255,255,255,0.90)",
    fontSize: 14,
    fontWeight: "800",
    alignSelf: "flex-end",
  },

  // Drawer
  drawerWrap: { flex: 1, flexDirection: "row" },
  drawerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.30)" },
  drawerSafe: { height: "100%", backgroundColor: "transparent" },
  drawerTopGap: { height: DRAWER_TOP_GAP },
  drawerPanelInner: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 14,
    borderLeftWidth: 1,
    borderLeftColor: "#eee",
  },

  drawerHeaderPremium: {
    borderRadius: 22,
    backgroundColor: NAVY,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  drawerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  drawerAvatarWrapPremium: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  drawerAvatarPremium: { width: 48, height: 48 },
  drawerHelloPremium: {
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(255,255,255,0.80)",
  },
  drawerNamePremium: {
    fontSize: 16,
    fontWeight: "900",
    color: "#fff",
    marginTop: 2,
  },
  drawerSubPremium: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.78)",
    marginTop: 2,
  },
  drawerCloseBtnPremium: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  drawerStatsPremium: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 18,
    paddingVertical: 10,
  },
  drawerStatItem: { flex: 1, alignItems: "center" },
  drawerStatValuePremium: { fontSize: 16, fontWeight: "900", color: "#fff" },
  drawerStatLabelPremium: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(255,255,255,0.78)",
  },
  drawerStatDividerPremium: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  refreshResumenBtnPremium: {
    marginTop: 12,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  refreshResumenTextPremium: { fontSize: 12, fontWeight: "900", color: "#fff" },

  drawerSectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#111",
    marginBottom: 8,
  },

  drawerItemPremium: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "#0b1220",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.10)",
    marginBottom: 10,
  },
  drawerItemIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  drawerItemIconRed: {
    backgroundColor: "rgba(239,68,68,0.30)",
    borderColor: "rgba(239,68,68,0.35)",
  },
  drawerItemTextPremium: {
    fontSize: 13,
    fontWeight: "900",
    color: "#e2e8f0",
    flex: 1,
  },
  drawerItemDanger: {
    backgroundColor: "#2a0b0b",
    borderColor: "rgba(239,68,68,0.25)",
  },

  noticeBox: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,86,184,0.18)",
    backgroundColor: "#eef5ff",
    padding: 10,
  },
  noticeTitle: { fontSize: 12, fontWeight: "900", color: BLUE_DARK },
  noticeText: { marginTop: 4, fontSize: 12, color: "#334", fontWeight: "600" },

  debugBox: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,86,184,0.18)",
    backgroundColor: "#fff",
    padding: 10,
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#111",
    marginBottom: 6,
  },
  debugLine: {
    fontSize: 12,
    color: "#333",
    marginBottom: 4,
    fontWeight: "600",
  },
  debugLabel: { fontWeight: "900", color: "#111" },
  debugBtn: {
    marginTop: 6,
    backgroundColor: BLUE_DARK,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  debugBtnText: { color: "#fff", fontWeight: "900", fontSize: 12 },
});
