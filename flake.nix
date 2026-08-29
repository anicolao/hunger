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
      in {
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
          ];

          shellHook = ''
            export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
            echo "Learn Your Appetite environment ready: Bun, Playwright, and PDF/OCR tools"
          '';
        };
      });
}
