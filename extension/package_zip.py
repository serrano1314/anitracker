"""Zip extension/dist into frontend/public for the website download."""

import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = Path(__file__).resolve().parent / "dist"
DEST = ROOT / "frontend" / "public" / "anime-tracker-extension.zip"
FOLDER = "anime-tracker-extension"


def main() -> None:
    if not (DIST / "manifest.json").is_file():
        raise SystemExit("Build the extension first: npm run build")
    DEST.parent.mkdir(parents=True, exist_ok=True)
    if DEST.exists():
        DEST.unlink()
    with zipfile.ZipFile(DEST, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(DIST.rglob("*")):
            if path.is_file():
                archive.write(path, arcname=f"{FOLDER}/{path.relative_to(DIST).as_posix()}")


if __name__ == "__main__":
    main()
