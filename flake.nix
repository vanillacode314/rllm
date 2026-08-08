{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-26.05";
    nixpkgs-unstable.url = "github:nixos/nixpkgs/nixos-unstable";
  };
  outputs =
    { ... }@inputs:
    let
      system = "x86_64-linux";
      pkgs = import inputs.nixpkgs {
        inherit system;
        overlays = [ ];
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
      ];
      webDeps = with pkgs; [
        buf
        nodejs
        bun
        typescript-language-server
        caddy
      ];
      androidDeps = [
        jdk
        pkgs-unstable.android-studio
      ];
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
          '';
        };
        android = default;
      };
      packages.${system} = {
        inherit (pkgs) caddy;
        inherit bun;
      };
    };
}
