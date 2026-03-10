// app/intro.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { height } = Dimensions.get("window");

const LOCAL_LOGO = require("../assets/LOGO.png");

export default function IntroScreen() {
  const router = useRouter();

  const translateY = useRef(new Animated.Value(0)).current;
  const arrowTranslate = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animación suave de la flecha
    Animated.loop(
      Animated.sequence([
        Animated.timing(arrowTranslate, {
          toValue: -14,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(arrowTranslate, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Animación sutil del logo (respiración)
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const handleNavigation = async () => {
    const token = await AsyncStorage.getItem("userToken");
    if (token) {
      router.replace("/(main)/perfil");
    } else {
      router.replace("/(auth)/login");
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy < -10,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -120) {
          Animated.timing(translateY, {
            toValue: -height,
            duration: 300,
            useNativeDriver: true,
          }).start(handleNavigation);
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[styles.content, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        {/* Logo */}
        <Animated.View style={{ transform: [{ scale: logoScale }] }}>
          <Image source={LOCAL_LOGO} style={styles.logo} resizeMode="contain" />
        </Animated.View>

        {/* Espacio */}
        <View style={{ height: 60 }} />

        {/* Indicador deslizar */}
        <View style={styles.hintWrapper}>
          <Animated.Text
            style={[
              styles.arrow,
              { transform: [{ translateY: arrowTranslate }] },
            ]}
          >
            ↑
          </Animated.Text>

          <Text style={styles.hint}>Desliza hacia arriba para continuar</Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1f4a",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 240,
  },
  logo: {
    width: 230,
    height: 230,
  },
  hintWrapper: {
    alignItems: "center",
  },
  arrow: {
    fontSize: 28,
    color: "#ffffff",
    opacity: 0.6,
    marginBottom: 8,
  },
  hint: {
    color: "#ffffff",
    fontSize: 15,
    opacity: 0.75,
    letterSpacing: 0.6,
  },
});
