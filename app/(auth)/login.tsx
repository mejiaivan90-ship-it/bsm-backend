// app/(auth)/login.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

// ✅ ÚNICO API FILE
import { API_BASE_URL } from "../../confi/api";

type LoginResponse = {
  token: string;
  companyName: string;
  logoUrl?: string;
  email?: string;
};

export default function LoginScreen() {
  const router = useRouter();

  // ✅ iniciar SIEMPRE en blanco
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const api = useMemo(() => {
    return {
      async login(payload: { email: string; password: string }) {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const msg =
            data?.error ||
            data?.detail ||
            `Error de login (HTTP ${res.status})`;
          throw new Error(msg);
        }

        return data as LoginResponse;
      },
    };
  }, []);

  const clearPreviousSession = async () => {
    try {
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
    } catch {
      // ignore
    }
  };

  const handleLogin = async () => {
    Keyboard.dismiss();

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      Alert.alert("Error", "Por favor, ingresa tu correo y contraseña");
      return;
    }

    setLoading(true);

    try {
      // ✅ limpiar sesión/cache anterior ANTES de guardar nueva sesión
      await clearPreviousSession();

      const data = await api.login({
        email: cleanEmail,
        password: cleanPassword,
      });

      await AsyncStorage.multiSet([
        ["userToken", data.token],
        ["userName", data.companyName],
        ["companyName", data.companyName],
        ["logoUrl", data.logoUrl || ""],
        ["userEmail", data.email || cleanEmail],
      ]);

      router.replace("/(main)/perfil");
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.message ||
          "No se pudo iniciar sesión. Revisa tu conexión y el servidor.",
      );
    } finally {
      setLoading(false);
    }
  };

  const goBackToIntro = () => {
    router.replace("/");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.screen}>
            <TouchableOpacity
              onPress={goBackToIntro}
              activeOpacity={0.85}
              style={styles.backBtn}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>

            <Animated.View entering={FadeInDown.delay(120).springify()}>
              <Image
                source={require("../../assets/LOGO.png")}
                style={styles.brandLogo}
                resizeMode="contain"
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(180).springify()}>
              <Text style={styles.title}>Iniciar sesión</Text>
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(240).springify()}
              style={styles.card}
            >
              <Text style={styles.label}>Correo</Text>
              <TextInput
                style={styles.input}
                placeholder="correo@empresa.com"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={[styles.label, { marginTop: 14 }]}>Contraseña</Text>

              <View style={styles.passwordWrap}>
                <TextInput
                  style={styles.inputPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  activeOpacity={0.85}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#0f172a"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && { opacity: 0.75 }]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.9}
              >
                <Text style={styles.primaryBtnText}>
                  {loading ? "Ingresando..." : "Continuar"}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const BLUE = "#0b1f4a";
const BTN = "#0a1f45";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BLUE },

  screen: {
    flex: 1,
    backgroundColor: BLUE,
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 14,
  },

  backBtn: {
    position: "absolute",
    left: 18,
    top: 14,
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  brandLogo: {
    width: 240,
    height: 240,
    marginTop: 90,
  },

  title: {
    marginTop: 18,
    color: "#fff",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0.2,
    textAlign: "center",
  },

  card: {
    marginTop: 22,
    width: "100%",
    borderRadius: 28,
    backgroundColor: "#fff",
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },

  label: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 10,
  },

  input: {
    height: 56,
    borderRadius: 18,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 16,
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
  },

  passwordWrap: {
    position: "relative",
    justifyContent: "center",
  },

  inputPassword: {
    height: 56,
    borderRadius: 18,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 16,
    paddingRight: 62,
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
  },

  eyeBtn: {
    position: "absolute",
    right: 10,
    width: 44,
    height: 44,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryBtn: {
    marginTop: 20,
    height: 64,
    borderRadius: 22,
    backgroundColor: BTN,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryBtnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
});
