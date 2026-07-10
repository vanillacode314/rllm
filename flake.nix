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
    in
    {
      devShells.${system} = {
        default = pkgs.mkShellNoCC {
          packages = with pkgs; [
            buf
            nodejs
            bun
            eslint_d
            prettierd
            typescript-language-server
            turso-cli
            caddy
            just
            jdk
            pkgs-unstable.android-studio
          ];
          shellHook = ''
            export PATH="$JAVA_HOME/bin:$PATH";

            echo "node_version: $(${pkgs.nodejs}/bin/node --version)"
            echo "bun_version: $(${pkgs.bun}/bin/bun --version)"
            echo "caddy_version: $(${pkgs.caddy}/bin/caddy --version)"
          '';
          CAPACITOR_ANDROID_STUDIO_PATH = "${pkgs-unstable.android-studio}/bin/android-studio";
          JAVA_HOME = "${jdk.home}";
        };
      };
      packages.${system} = {
        inherit (pkgs) bun caddy;
        # inherit (pkgs-2505) caddy;
      };
    };
}
