import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

const BLUE = "#0056b8";
const BLUE_DARK = "#002d74";

export default function NewsletterPreview() {
  return (
    <View style={styles.card}>
      {/* Header del módulo */}
      <View style={styles.header}>
        <Text style={styles.title}>HIGH PERFORMANCE TALENT ⭐</Text>
        <Text style={styles.subtitle}>
          ¿Listo para ser talento de alto rendimiento?
        </Text>
      </View>

      {/* Contenido */}
      <View style={styles.webviewWrapper}>
        <WebView
          source={{
            uri: "https://www.linkedin.com/newsletters/high-performance-talent-7055226808064999425/",
          }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={BLUE} />
            </View>
          )}
          javaScriptEnabled
          domStorageEnabled
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },

  header: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#F3F7FF",
    borderBottomWidth: 1,
    borderBottomColor: "#DDEBFF",
  },

  title: {
    fontSize: 16,
    fontWeight: "900",
    color: BLUE_DARK,
  },

  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: BLUE,
    fontWeight: "700",
  },

  webviewWrapper: {
    height: 320,
    backgroundColor: "#fff",
  },

  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
});
