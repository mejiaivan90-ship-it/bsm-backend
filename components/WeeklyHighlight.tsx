import { StyleSheet, Text, View } from "react-native";

type Props = {
  title?: string;
  content: string;
  author?: string;
};

const BLUE = "#0056b8";
const BLUE_DARK = "#002d74";

export default function WeeklyHighlight({
  title = "Frase de la semana",
  content,
  author,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>

      <Text style={styles.content}>“{content}”</Text>

      {author ? <Text style={styles.author}>— {author}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F3F7FF",
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: "#DDEBFF",
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: BLUE_DARK,
    marginBottom: 10,
  },
  content: {
    fontSize: 16,
    color: "#111",
    fontStyle: "italic",
    lineHeight: 22,
  },
  author: {
    marginTop: 10,
    fontSize: 14,
    color: BLUE,
    textAlign: "right",
    fontWeight: "700",
  },
});
