{
  description = "Learn Your Appetite application and PDF development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        lib = pkgs.lib;

        commonInputs = with pkgs; [
          bash
          bun
          coreutils
          findutils
          gnugrep
          gnused
          git
          jq
        ];

        darwinInputs = lib.optionals pkgs.stdenv.hostPlatform.isDarwin (with pkgs; [
          xcbeautify
          xcodegen
        ]);

        darwinGuard = ''
          if [[ "$(uname -s)" != "Darwin" ]]; then
            echo "This command requires macOS and Apple's Xcode." >&2
            exit 1
          fi

          default_developer_dir="/Applications/Xcode.app/Contents/Developer"
          export DEVELOPER_DIR="''${HUNGER_DEVELOPER_DIR:-$default_developer_dir}"
          export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
          if [[ ! -x "$DEVELOPER_DIR/usr/bin/xcodebuild" ]]; then
            echo "Xcode was not found at $DEVELOPER_DIR." >&2
            exit 1
          fi
        '';

        repoGuard = ''
          repo_root="$(git rev-parse --show-toplevel)"
          cd "$repo_root"
          if [[ ! -f "flake.nix" || ! -f "IOS_DESIGN.md" ]]; then
            echo "Run this command from the Hunger repository." >&2
            exit 1
          fi
        '';

        iosBuildWeb = pkgs.writeShellApplication {
          name = "hunger-ios-build-web";
          runtimeInputs = commonInputs;
          text = ''
            ${repoGuard}

            resource_root="$repo_root/ios/Hunger/Resources/WebApp"
            expected_resource_root="$repo_root/ios/Hunger/Resources/WebApp"
            if [[ "$resource_root" != "$expected_resource_root" ]]; then
              echo "Refusing to replace unexpected resource path: $resource_root" >&2
              exit 1
            fi

            VITE_NATIVE_SHELL=ios VITE_GIT_HASH="''${VITE_GIT_HASH:-native}" bun run build

            rm -rf "$resource_root"
            mkdir -p "$resource_root"
            cp -R "$repo_root/build/." "$resource_root/"
            rm -f \
              "$resource_root/service-worker.js" \
              "$resource_root/manifest.webmanifest" \
              "$resource_root/404.html"

            if rg -q '__HUNGER_E2E__|data-e2e-fixture|serviceWorker\.register' "$resource_root"; then
              echo "Development or service-worker code leaked into the native bundle." >&2
              exit 1
            fi

            manifest_tmp="$(mktemp)"
            trap 'rm -f "$manifest_tmp"' EXIT
            while IFS= read -r relative_path; do
              file_path="$resource_root/$relative_path"
              case "$relative_path" in
                *.html) mime_type="text/html" ;;
                *.css) mime_type="text/css" ;;
                *.js) mime_type="text/javascript" ;;
                *.json) mime_type="application/json" ;;
                *.svg) mime_type="image/svg+xml" ;;
                *.png) mime_type="image/png" ;;
                *.webp) mime_type="image/webp" ;;
                *.woff2) mime_type="font/woff2" ;;
                *) mime_type="application/octet-stream" ;;
              esac
              jq -nc \
                --arg path "$relative_path" \
                --arg mimeType "$mime_type" \
                --arg sha256 "$(sha256sum "$file_path" | cut -d ' ' -f 1)" \
                --argjson bytes "$(wc -c < "$file_path" | tr -d ' ')" \
                '{path: $path, mimeType: $mimeType, sha256: $sha256, bytes: $bytes}'
            done < <(
              cd "$resource_root"
              find . -type f ! -name asset-manifest.json -print \
                | sed 's#^\./##' \
                | LC_ALL=C sort
            ) | jq -s '{version: 1, files: .}' > "$manifest_tmp"
            mv "$manifest_tmp" "$resource_root/asset-manifest.json"
            trap - EXIT

            echo "Packaged $(jq '.files | length' "$resource_root/asset-manifest.json") offline web resources."
          '';
        };

        iosGenerate = pkgs.writeShellApplication {
          name = "hunger-ios-generate";
          runtimeInputs = commonInputs ++ darwinInputs;
          text = ''
            ${darwinGuard}
            ${repoGuard}
            if [[ ! -d "$repo_root/ios/Hunger/Resources/WebApp" ]]; then
              echo "Build the native web resources before generating the project." >&2
              exit 1
            fi
            xcodegen generate \
              --spec "$repo_root/ios/project.yml" \
              --project "$repo_root/ios"
          '';
        };

        iosXcodeTest = testTarget: pkgs.writeShellApplication {
          name = "hunger-ios-test-${testTarget}";
          runtimeInputs = commonInputs ++ darwinInputs;
          text = ''
            ${darwinGuard}
            ${repoGuard}
            ${lib.getExe iosBuildWeb}
            ${lib.getExe iosGenerate}
            destination="''${IOS_DESTINATION:-platform=iOS Simulator,name=iPhone 17,OS=latest}"
            set -o pipefail
            xcodebuild test \
              -project "$repo_root/ios/Hunger.xcodeproj" \
              -scheme Hunger \
              -destination "$destination" \
              -derivedDataPath "$repo_root/.derived-data/ios" \
              -only-testing:Hunger${testTarget} \
              CODE_SIGNING_ALLOWED=NO \
              | xcbeautify
          '';
        };

        iosTestUnit = iosXcodeTest "Tests";
        iosTestUi = iosXcodeTest "UITests";

        iosVerify = pkgs.writeShellApplication {
          name = "hunger-ios-verify";
          runtimeInputs = commonInputs ++ darwinInputs;
          text = ''
            ${darwinGuard}
            ${repoGuard}
            bun install --frozen-lockfile
            bun run check
            bun run test:unit
            ${lib.getExe iosBuildWeb}
            ${lib.getExe iosGenerate}
            git diff --exit-code -- ios/Hunger.xcodeproj
            ${lib.getExe iosTestUnit}
            ${lib.getExe iosTestUi}
            git diff --check
          '';
        };
      in {
        apps = {
          ios-build-web = flake-utils.lib.mkApp { drv = iosBuildWeb; };
          ios-generate = flake-utils.lib.mkApp { drv = iosGenerate; };
          ios-test-unit = flake-utils.lib.mkApp { drv = iosTestUnit; };
          ios-test-ui = flake-utils.lib.mkApp { drv = iosTestUi; };
          ios-verify = flake-utils.lib.mkApp { drv = iosVerify; };
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            # Build and verify the static SvelteKit application.
            bun
            nodejs_24
            playwright-driver.browsers

            # Inspect, extract text/images, and render PDF pages.
            poppler-utils
            qpdf

            # OCR scanned or image-only documents.
            ocrmypdf
            tesseract

            # Inspect and convert source images and rendered pages.
            imagemagick
            exiftool
            ghostscript
          ] ++ darwinInputs;

          shellHook = ''
            export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
            if [[ "$(uname -s)" == "Darwin" && -d "/Applications/Xcode.app/Contents/Developer" ]]; then
              export DEVELOPER_DIR="''${HUNGER_DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
              export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
            fi
            echo "Learn Your Appetite environment ready: Bun, Playwright, PDF/OCR, and iOS tools"
          '';
        };
      });
}
