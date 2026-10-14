import React, { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Search, Volume2 } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSuryoyeTheme } from "../../theme/colors";
import { searchDictionary } from "../../db/queries/lessons";
import { WordRow } from "../../db/schema";
import { suraytAudio } from "../../engine/audio";
import { DualScriptText } from "../../components/typography/DualScriptText";
import { ScriptModeBar } from "../../components/suryoye-ui/ScriptModeBar";

export default function DictionaryScreen() {
  const theme = useSuryoyeTheme();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WordRow[]>([]);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    searchDictionary(text).then((words) => {
      setResults(words);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      searchDictionary("").then((words) => {
        setResults(words);
      });
    }, [])
  );

  const handlePlayAudio = (word: WordRow) => {
    Haptics.selectionAsync();
    suraytAudio.playPronunciation(word.id, word.audioUrl);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: theme.textSecondary }]}>
          OFFLINE SURAYT LEXICON
        </Text>
        <Text style={[styles.screenTitle, { color: theme.textPrimary }]}>
          Woordenboek
        </Text>

        <ScriptModeBar />

        <View style={[styles.searchBox, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Search size={18} color={theme.textMuted} />
          <TextInput
            value={query}
            onChangeText={handleSearch}
            placeholder="Zoek woord (bijv. slomo, kthowo, water)..."
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.textPrimary }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.wordCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.wordInfo}>
              <DualScriptText
                serto={item.suraytSerto}
                sertoUnvocalized={item.suraytSertoUnvocalized}
                latin={item.suraytLat}
                variant="md"
              />
              <Text style={[styles.translation, { color: theme.textSecondary }]}>
                {item.translationNl}
              </Text>
              {item.rootRadicals && (
                <Text style={[styles.root, { color: theme.textMuted }]}>
                  Wortel: {item.rootRadicals}
                </Text>
              )}
            </View>

            <Pressable
              onPress={() => handlePlayAudio(item)}
              style={[styles.audioBtn, { backgroundColor: theme.surfaceElevated }]}
            >
              <Volume2 size={20} color={theme.primary} />
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { padding: 16, paddingBottom: 8 },
  kicker: { fontSize: 11, fontFamily: "NotoSans-Bold", letterSpacing: 1.2, textTransform: "uppercase" },
  screenTitle: { fontSize: 24, fontFamily: "NotoSans-Bold", marginVertical: 6 },
  searchBox: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginTop: 8 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, fontFamily: "NotoSans-Regular" },
  listContent: { padding: 16, paddingTop: 8 },
  wordCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  wordInfo: { flex: 1, marginRight: 12 },
  translation: { fontSize: 14, fontFamily: "NotoSans-Regular", marginTop: 4 },
  root: { fontSize: 11, fontFamily: "NotoSans-Regular", marginTop: 2 },
  audioBtn: { padding: 10, borderRadius: 10 },
});
