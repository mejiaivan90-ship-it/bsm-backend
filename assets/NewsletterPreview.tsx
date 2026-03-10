// app/components/NewsletterPreview.tsx
import { useEffect, useState } from "react";
import { FlatList, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function NewsletterPreview() {
  const [articles, setArticles] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const data = require("../../assets/data/newsletter.json");
        setArticles(data);
      } catch (error) {
        console.log("Error cargando newsletter:", error);
      }
    }
    loadData();
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={articles}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => Linking.openURL(item.link)}
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.summary}>{item.summary}</Text>
            <Text style={styles.link}>Ver en LinkedIn</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    width: 250,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#03341c",
    marginBottom: 6,
  },
  summary: {
    fontSize: 14,
    color: "#555",
    marginBottom: 8,
  },
  link: {
    fontSize: 13,
    color: "#0077b5",
    fontWeight: "600",
  },
});
