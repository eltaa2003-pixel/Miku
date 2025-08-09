{ pkgs ? import <nixpkgs> {} }:
{
  deps = with pkgs; [
    nodejs-20_x
    nodePackages.typescript
    ffmpeg
    imagemagick
    git
    neofetch
    libwebp
    speedtest-cli
    wget
    yarn
    libuuid
  ];

  env = {
    LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [ libuuid ];
  };
}
