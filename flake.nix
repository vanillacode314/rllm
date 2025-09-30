{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
  };
  outputs =
    { ... }@inputs:
    let
      system = "x86_64-linux";
      pkgs = import inputs.nixpkgs {
        inherit system;
        overlays = [ ];
      };
    in
    {
      devShells.${system}.default = pkgs.mkShellNoCC {
        packages = with pkgs; [
          nodejs
          bun
          eslint_d
          prettierd
          typescript-language-server
          turso-cli
        ];
        shellHook = ''
          echo "node_version: $(${pkgs.nodejs}/bin/node --version)"
          echo "bun_version: $(${pkgs.bun}/bin/bun --version)"
        '';
      };
    };
}
