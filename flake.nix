{
  description = "Learn Your Appetite PDF review and development environment";

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
            echo "PDF tooling ready: pdftotext, pdfinfo, pdftoppm, OCRmyPDF, and Tesseract"
          '';
        };
      });
}
