import asyncio
import logging
import shutil
import subprocess
from pathlib import Path
from typing import Dict, List
import httpx

logger = logging.getLogger(__name__)


class SuraytAudioDownloader:
    """
    Downloadt en comprimeert Surayt uitspraak-mp3's voor offline gebruik in Expo.
    Normaliseert luidheid naar -16 LUFS (EBU R128) indien ffmpeg geïnstalleerd is.
    """

    def __init__(self, output_base_dir: Path, max_concurrency: int = 6):
        self.output_base_dir = output_base_dir
        self.semaphore = asyncio.Semaphore(max_concurrency)
        self.has_ffmpeg = shutil.which("ffmpeg") is not None

    async def download_batch(self, items: List[Dict[str, str]]) -> Dict[str, bool]:
        """
        Verwacht een lijst van dicts met {'id': ..., 'audio_url': ..., 'audio_local': ...}.
        Retourneert een status-map per item ID.
        """
        status_map: Dict[str, bool] = {}
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            tasks = [
                self._download_and_process(client, item, status_map)
                for item in items
                if item.get("audio_url") and item.get("audio_local")
            ]
            if tasks:
                await asyncio.gather(*tasks)
        return status_map

    async def _download_and_process(
        self,
        client: httpx.AsyncClient,
        item: Dict[str, str],
        status_map: Dict[str, bool],
    ) -> None:
        item_id = item["id"]
        url = item["audio_url"]
        rel_path = item["audio_local"]
        target_path = self.output_base_dir / rel_path
        target_path.parent.mkdir(parents=True, exist_ok=True)

        if target_path.exists() and target_path.stat().st_size > 512:
            status_map[item_id] = True
            return

        async with self.semaphore:
            try:
                response = await client.get(url)
                response.raise_for_status()
                raw_tmp = target_path.with_suffix(".raw.mp3")
                raw_tmp.write_bytes(response.content)

                if self.has_ffmpeg:
                    self._compress_and_normalize_mp3(raw_tmp, target_path)
                    raw_tmp.unlink(missing_ok=True)
                else:
                    raw_tmp.rename(target_path)

                status_map[item_id] = True
                logger.info(f"Audio opgeslagen: {target_path.name}")
            except Exception as exc:
                logger.warning(f"Audio download overgeslagen voor {item_id} ({url}): {exc}")
                status_map[item_id] = False

    @staticmethod
    def _compress_and_normalize_mp3(input_path: Path, output_path: Path) -> None:
        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            str(input_path),
            "-af",
            "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-ac",
            "1",
            "-ar",
            "44100",
            "-b:a",
            "64k",
            str(output_path),
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
