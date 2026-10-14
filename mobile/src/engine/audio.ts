import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";

const AUDIO_CACHE_DIR = `${FileSystem.documentDirectory}surayt_audio_cache/`;

class SuraytAudioManager {
  private currentSound: Audio.Sound | null = null;
  private isConfigured = false;

  private async ensureConfigured(): Promise<void> {
    if (this.isConfigured) return;
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
    const dirInfo = await FileSystem.getInfoAsync(AUDIO_CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(AUDIO_CACHE_DIR, { intermediates: true });
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
      await Haptics.selectionAsync();

      if (this.currentSound) {
        await this.currentSound.unloadAsync();
        this.currentSound = null;
      }

      const cachedFileUri = `${AUDIO_CACHE_DIR}${itemId}.mp3`;
      const cachedInfo = await FileSystem.getInfoAsync(cachedFileUri);

      let sourceUri: string | null = null;

      if (cachedInfo.exists && cachedInfo.size > 512) {
        sourceUri = cachedFileUri;
      } else if (remoteAudioUrl && remoteAudioUrl.startsWith("http")) {
        // Download eenmalig naar de lokale cache voor toekomstig offline gebruik
        try {
          const downloadRes = await FileSystem.downloadAsync(remoteAudioUrl, cachedFileUri);
          if (downloadRes.status === 200) {
            sourceUri = downloadRes.uri;
          } else {
            sourceUri = remoteAudioUrl;
          }
        } catch {
          sourceUri = remoteAudioUrl;
        }
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
