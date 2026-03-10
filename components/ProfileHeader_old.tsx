import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  name: string;
  onEditPress: () => void;
  onAvatarPress?: () => void;
  imageUri?: string | null;
  greeting?: string;
};

export default function ProfileHeader({
  name,
  onEditPress,
  onAvatarPress,
  imageUri,
  greeting,
}: Props) {
  const initial = name ? name.trim().charAt(0).toUpperCase() : "?";

  return (
    <View style={styles.headerContainer}>
      {/* Fila superior con avatar y logo */}
      <View style={styles.topRow}>
        {/* Foto o inicial */}
        <TouchableOpacity
          onPress={onAvatarPress ?? onEditPress}
          style={styles.avatarWrapper}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Logo arriba a la derecha */}
        <Image source={require("../../assets/LOGO.png")} style={styles.logo} />
      </View>

      {/* Info del usuario */}
      <View style={styles.info}>
        {greeting ? <Text style={styles.greeting}>{greeting}</Text> : null}
        <Text style={styles.welcome}>Bienvenido</Text>
        <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
          {name}
        </Text>
      </View>

      {/* Botón editar */}
      <TouchableOpacity style={styles.editButton} onPress={onEditPress}>
        <Text style={styles.editText}>Editar</Text>
      </TouchableOpacity>
    </View>
  );
}

const shadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius: 6,
  },
  android: {
    elevation: 4,
  },
});

const smallShadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  android: {
    elevation: 3,
  },
});

const styles = StyleSheet.create({
  headerContainer: {
    width: "100%",
    backgroundColor: "#a8cbb7", // ← color nuevo de la franja (resalta el logo blanco)
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    alignItems: "center",
    ...shadow,
  },
  topRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatarWrapper: {
    marginRight: 16,
  },
  avatarPlaceholder: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#03341c",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    ...smallShadow,
  },
  avatarImage: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: "#fff",
    ...smallShadow,
  },
  avatarText: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "700",
  },
  logo: {
    width: 65,
    height: 65,
    resizeMode: "contain",
  },
  info: {
    marginTop: 10,
    alignItems: "center",
  },
  greeting: {
    color: "#2b6b49",
    fontSize: 13,
    marginBottom: 4,
  },
  welcome: {
    color: "#03341c",
    fontSize: 16,
    fontWeight: "700",
  },
  name: {
    color: "#03341c",
    fontSize: 18,
    fontWeight: "700",
  },
  editButton: {
    marginTop: 10,
    backgroundColor: "#03341c",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    ...smallShadow,
  },
  editText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
