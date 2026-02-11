{
  inputs = {
    nixpkgs-2505.url = "github:nixos/nixpkgs/nixos-25.05";
    nixpkgs.url = "github:nixos/nixpkgs/nixos-25.11";
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
        overlays = [ ];
      };
      pkgs-2505 = import inputs.nixpkgs-2505 {
        inherit system;
        overlays = [ ];
      };
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
            pkgs-2505.caddy
          ];
          shellHook = ''
            echo "node_version: $(${pkgs.nodejs}/bin/node --version)"
            echo "bun_version: $(${pkgs.bun}/bin/bun --version)"
            echo "caddy_version: $(${pkgs.caddy}/bin/caddy --version)"
          '';
        };
      };
      packages.${system} = {
        inherit (pkgs) bun;
        inherit (pkgs-2505) caddy;
      };
    };
}
