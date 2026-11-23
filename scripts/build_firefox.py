"""Build the desktop and Android Firefox extension and its AMO reviewer source."""

import argparse
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def build(source: Path, output: Path) -> Path:
    manifest = json.loads((source / "manifest.json").read_text(encoding="utf-8-sig"))
    manifest["background"] = {"scripts": [manifest["background"]["service_worker"]]}
    manifest["browser_specific_settings"] = {
        "gecko": {
            "id": "dlook@dlook.site",
            "strict_min_version": "140.0",
            "data_collection_permissions": {"required": ["browsingActivity", "websiteContent"]},
        },
        # Firefox for Android added built-in data consent in version 142.
        "gecko_android": {"strict_min_version": "142.0"},
    }
    package = output / f"DLook-Firefox-{manifest['version']}.zip"
    with ZipFile(package, "w", ZIP_DEFLATED, compresslevel=9) as archive:
        for file in sorted(source.rglob("*")):
            if not file.is_file():
                continue
            name = file.relative_to(source).as_posix()
            content = file.read_bytes()
            if name == "manifest.json":
                content = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()
            elif file.suffix == ".js":
                code = content.decode("utf-8-sig")
                for api in ("runtime", "tabs", "storage"):
                    code = code.replace("chrome." + api, "browser." + api)
                if name == "currency.js":
                    url = "'/home/api/=/exchangeConfig.json'"
                    code = code.replace("fetch(" + url, "fetch(new URL(" + url + ", location.origin)")
                content = code.encode()
            archive.writestr(name, content)
    return package


def main() -> None:
    script = Path(__file__).resolve()
    root = script.parent.parent if script.parent.name == "scripts" else script.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=root / "exports" if root != script.parent else root)
    parser.add_argument("--reviewer-source", action="store_true")
    options = parser.parse_args()
    source = root / "chrome-extension"
    options.output.mkdir(parents=True, exist_ok=True)
    package = build(source, options.output)
    print(package)
    if options.reviewer_source:
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
            archive.write(script, "build_firefox.py")
            for file in sorted(source.rglob("*")):
                if file.is_file():
                    archive.write(file, file.relative_to(root).as_posix())
        print(reviewer)


if __name__ == "__main__":
    main()
