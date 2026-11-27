"""Build the release assets for DLook with the new DLsite Play UI (play-ui-next).

Writes exports/<version>/ with the same files as earlier releases:
  DLook-Chrome-<v>.zip, DLook-Edge-<v>.zip, DLook-Firefox-<v>.zip, DLook-Firefox-<v>-source.zip,
  DLook-Safari.user.js, DLook-Safari.meta.js

Usage (from the repository root):  python play-ui-next/scripts/build_release.py
Development-only folders (dev/, dist/, scripts/) and the README are not packaged.
The Firefox package reuses scripts/build_firefox.py unchanged; its reviewer source places the
packaged files under chrome-extension/, so running build_firefox.py there reproduces it.
"""

import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

here = Path(__file__).resolve().parent
extension = here.parent
root = extension.parent
EXCLUDE_DIRS = {"dev", "dist", "scripts", "node_modules", ".git"}
EXCLUDE_FILES = {"README.md"}


def packaged_files():
    for file in sorted(extension.rglob("*")):
        relative = file.relative_to(extension)
        if not file.is_file() or relative.parts[0] in EXCLUDE_DIRS or relative.name in EXCLUDE_FILES:
            continue
        yield file, relative.as_posix()


def zip_extension(target: Path):
    with ZipFile(target, "w", ZIP_DEFLATED, compresslevel=9) as archive:
        for file, name in packaged_files():
            archive.write(file, name)


def main():
    version = json.loads((extension / "manifest.json").read_text(encoding="utf-8-sig"))["version"]
    output = root / "exports" / version
    output.mkdir(parents=True, exist_ok=True)

    chrome = output / f"DLook-Chrome-{version}.zip"
    zip_extension(chrome)
    shutil.copyfile(chrome, output / f"DLook-Edge-{version}.zip")

    spec = importlib.util.spec_from_file_location("build_firefox", root / "scripts" / "build_firefox.py")
    firefox = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(firefox)
    with tempfile.TemporaryDirectory() as temporary:
        staged = Path(temporary) / "chrome-extension"
        for file, name in packaged_files():
            target = staged / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(file, target)
        package = firefox.build(staged, output)
        reviewer = package.with_name(f"{package.stem}-source.zip")
        readme = (
            "DLook Firefox reviewer source\n\n"
            "Extract this archive and run python build_firefox.py from the extracted directory.\n"
            "The build uses Python 3.11 or newer and its standard library.\n"
            f"The command creates {package.name}. Compare the extracted file contents.\n"
            "The script sets the Gecko manifest and adapts WebExtension APIs and URL resolution.\n"
            "The package supports Firefox 140+ and Firefox for Android 142+.\n"
        )
        with ZipFile(reviewer, "w", ZIP_DEFLATED, compresslevel=9) as archive:
            archive.writestr("README.txt", readme)
            archive.write(root / "scripts" / "build_firefox.py", "build_firefox.py")
            for file in sorted(staged.rglob("*")):
                if file.is_file():
                    archive.write(file, f"chrome-extension/{file.relative_to(staged).as_posix()}")

    subprocess.run(["node", str(here / "build_userscript.mjs"), "--release"], cwd=root, check=True)
    for file in sorted(output.iterdir()):
        print(f"{file.relative_to(root).as_posix()}  {file.stat().st_size:,} bytes")


if __name__ == "__main__":
    sys.exit(main())
