import { Audio } from "expo-av";
import { File, Directory, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

class SuraytAudioManager {
  private currentSound: Audio.Sound | null = null;
  private isConfigured = false;
  private cacheDir: Directory | null = null;

  private async ensureConfigured(): Promise<void> {
    if (this.isConfigured) return;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    } catch {
      // Audio configuratie fallback voor web/omgevingen zonder native audio mode
    }

    if (Platform.OS !== "web") {
      try {
        this.cacheDir = new Directory(Paths.cache, "surayt_audio_cache");
        if (!this.cacheDir.exists) {
          this.cacheDir.create({ idempotent: true });
        }
      } catch (err) {
        console.warn("Kon audiocache directory niet aanmaken:", err);
      }
    }
    this.isConfigured = true;
  }

  /**
   * Speelt de uitspraak van een woord of zin af en geeft subtiele haptische feedback.
   */
  public async playPronunciation(
    itemId: string,
    remoteAudioUrl?: string | null,
    playbackRate = 1.0
  ): Promise<boolean> {
    try {
      await this.ensureConfigured();
      if (Platform.OS !== "web") {
        await Haptics.selectionAsync();
      }

      if (this.currentSound) {
        await this.currentSound.unloadAsync();
        this.currentSound = null;
      }

      let sourceUri: string | null = null;

      // Op mobiel: gebruik lokale offline cache via Expo FileSystem File API
      if (Platform.OS !== "web" && this.cacheDir) {
        const cachedFile = new File(this.cacheDir, `${itemId}.mp3`);
        if (cachedFile.exists && (cachedFile.info().size ?? 0) > 512) {
          sourceUri = cachedFile.uri;
        } else if (remoteAudioUrl && remoteAudioUrl.startsWith("http")) {
          try {
            await File.downloadFileAsync(remoteAudioUrl, cachedFile, { idempotent: true });
            sourceUri = cachedFile.uri;
          } catch {
            sourceUri = remoteAudioUrl;
          }
        }
      } else if (remoteAudioUrl && remoteAudioUrl.startsWith("http")) {
        // Op web: stream direct vanaf de externe URL
        sourceUri = remoteAudioUrl;
      }

      if (!sourceUri) {
        return false;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: sourceUri },
        { shouldPlay: true, rate: playbackRate, shouldCorrectPitch: true }
      );

      this.currentSound = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });

      return true;
    } catch (error) {
      console.warn(`Kon audio voor '${itemId}' niet afspelen:`, error);
      return false;
    }
  }
}

export const suraytAudio = new SuraytAudioManager();
