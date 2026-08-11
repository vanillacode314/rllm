{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-26.05";
    nixpkgs-unstable.url = "github:nixos/nixpkgs/nixos-unstable";

    go-overlay.url = "github:purpleclay/go-overlay";
    go-overlay.inputs.nixpkgs.follows = "nixpkgs";
  };
  outputs =
    { ... }@inputs:
    let
      system = "x86_64-linux";
      pkgs = import inputs.nixpkgs {
        inherit system;
        overlays = [ inputs.go-overlay.overlays.default ];
      };
      pkgs-unstable = import inputs.nixpkgs-unstable {
        inherit system;
        config = {
          allowUnfreePredicate = pkg: builtins.elem (inputs.nixpkgs.lib.getName pkg) [ "android-studio" ];
        };
        overlays = [ ];
      };
      jdk = pkgs-unstable.jdk21;
      bun = pkgs-unstable.bun;
      devDeps = with pkgs; [
        turso-cli
        just
        inputs.go-overlay.packages.${system}.govendor
      ];
      webDeps = with pkgs; [
        buf
        nodejs
        bun
        typescript-language-server
        caddy
        go
        protoc-gen-go
      ];
      androidDeps = [
        jdk
        pkgs-unstable.android-studio
      ];
      syncServer = pkgs.buildGoWorkspace {
        inherit (pkgs) go;
        pname = "sync-server";
        version = "0.0.0";
        src = ./.;
        subPackages = [ "sync-server" ];
      };
    in
    {
      devShells.${system} = rec {
        default = pkgs.mkShellNoCC {
          packages = devDeps ++ webDeps ++ androidDeps;
          shellHook = ''
            export PATH="$JAVA_HOME/bin:$PATH";

            echo "node_version: $(${pkgs.nodejs}/bin/node --version)"
            echo "bun_version: $(${bun}/bin/bun --version)"
            echo "caddy_version: $(${pkgs.caddy}/bin/caddy --version)"
            echo "$(${pkgs.go}/bin/go version)"
          '';
          CAPACITOR_ANDROID_STUDIO_PATH = "${pkgs-unstable.android-studio}/bin/android-studio";
          JAVA_HOME = "${jdk.home}";
        };
        web = pkgs.mkShellNoCC {
          packages = devDeps ++ webDeps;
          shellHook = ''
            echo "node_version: $(${pkgs.nodejs}/bin/node --version)"
            echo "bun_version: $(${bun}/bin/bun --version)"
            echo "caddy_version: $(${pkgs.caddy}/bin/caddy --version)"
            echo "$(${pkgs.go}/bin/go version)"
          '';
        };
        android = default;
      };
      packages.${system} = {
        inherit (pkgs) caddy;
        inherit bun syncServer;
      };
    };
}
