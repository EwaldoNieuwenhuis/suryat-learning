import { createAudioPlayer } from "expo-audio";
import { File, Directory, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

class SuraytAudioManager {
  private currentPlayer: any = null;
  private isConfigured = false;
  private cacheDir: Directory | null = null;

  private async ensureConfigured(): Promise<void> {
    if (this.isConfigured) return;

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

      if (this.currentPlayer) {
        try {
          if (typeof this.currentPlayer.pause === "function") {
            this.currentPlayer.pause();
          }
          if (typeof this.currentPlayer.release === "function") {
            this.currentPlayer.release();
          } else if (typeof this.currentPlayer.remove === "function") {
            this.currentPlayer.remove();
          }
        } catch {}
        this.currentPlayer = null;
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

      // Web: HTML5 Audio fallback
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.Audio) {
          try {
            const webAudio = new window.Audio();
            webAudio.src = sourceUri;
            webAudio.playbackRate = playbackRate;
            webAudio.onerror = () => {
              // Vang ongeldige of ontbrekende audio-bronnen stil af op web
            };
            await webAudio.play();
            this.currentPlayer = webAudio;
            return true;
          } catch {
            return false;
          }
        }
        return false;
      }

      // Native (iOS & Android via expo-audio in SDK 57)
      const player = createAudioPlayer(sourceUri);
      if (typeof player.setPlaybackRate === "function" && playbackRate !== 1.0) {
        player.setPlaybackRate(playbackRate);
      }
      player.play();
      this.currentPlayer = player;

      return true;
    } catch (error) {
      console.warn(`Kon audio voor '${itemId}' niet afspelen:`, error);
      return false;
    }
  }
}

export const suraytAudio = new SuraytAudioManager();
