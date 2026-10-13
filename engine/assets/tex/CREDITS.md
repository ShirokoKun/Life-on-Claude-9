# Texture credits

All textures in this folder are **CC0 (public domain)**. No attribution is legally required; credited here anyway.

Sources: [Poly Haven](https://polyhaven.com) and [ambientCG](https://ambientcg.com) (by Lennart Demes).

Every map was resized to 2048x2048 and re-encoded as JPEG q90. Files: `albedo.jpg` (sRGB), `normal.jpg` (OpenGL / +Y), `rough.jpg` (greyscale), optional `ao.jpg`, `alpha.jpg`.

| Key | Asset | Source | tile_m | Notes |
|---|---|---|---|---|
| `plaster_wall` | White Stucco (`white_stucco`) | [Poly Haven](https://polyhaven.com/a/white_stucco) | 2.0 |  |
| `oak_floor` | Wood Floor (`wood_floor`) | [Poly Haven](https://polyhaven.com/a/wood_floor) | 1.7 |  |
| `walnut` | Wood 066 (`Wood066`) | [ambientCG](https://ambientcg.com/a/Wood066) | 0.4 |  |
| `light_wood` | Oak Veneer 01 (`oak_veneer_01`) | [Poly Haven](https://polyhaven.com/a/oak_veneer_01) | 1.83 |  |
| `painted_wood` | Plastic 013 A (`Plastic013A`) | [ambientCG](https://ambientcg.com/a/Plastic013A) | 1.0 (est.) | No clean white painted-wood/metal CC0 asset found (all are weathered/rusty); uses a subtle white satin plastic surface as a painted-finish stand-in. Rough ~0.40. |
| `black_metal` | Metal 027 (`Metal027`) | [ambientCG](https://ambientcg.com/a/Metal027) | 1.0 (est.) | Black powder-coated steel. Albedo desaturated to neutral (source had a faint blue cast). It is paint: use metalness 0-0.2. Rough ~0.65. |
| `brushed_metal` | Metal 009 (`Metal009`) | [ambientCG](https://ambientcg.com/a/Metal009) | 0.5 (est.) | Brush direction is horizontal (U). Use metalness 1. |
| `fabric_weave` | Fabric 039 (`Fabric039`) | [ambientCG](https://ambientcg.com/a/Fabric039) | 0.25 (est.) | Dark grey woven fabric; strong normal, use normalScale ~0.5-1. |
| `rug` | Carpet 016 (`Carpet016`) | [ambientCG](https://ambientcg.com/a/Carpet016) | 1.7 |  |
| `linen` | Fabric 036 (`Fabric036`) | [ambientCG](https://ambientcg.com/a/Fabric036) | 0.25 (est.) | Neutral light grey slub weave; tint via material.color. |
| `knit` | Fabric 019 (`Fabric019`) | [ambientCG](https://ambientcg.com/a/Fabric019) | 0.25 (est.) | White wool knit; tint via material.color. Source opacity map not included. |
| `cardboard` | Paper 004 (`Paper004`) | [ambientCG](https://ambientcg.com/a/Paper004) | 0.3 | Brown kraft packing paper. |
| `paper` | Paper 001 (`Paper001`) | [ambientCG](https://ambientcg.com/a/Paper001) | 0.3 (est.) | Source is 2048x1201 tileable; stacked 2x vertically then fit to 2048x2048 (fibres ~17% vertically compressed, still tileable). |
| `cork` | Cork 002 (`Cork002`) | [ambientCG](https://ambientcg.com/a/Cork002) | 0.5 (est.) |  |
| `concrete` | Brushed Concrete (`brushed_concrete`) | [Poly Haven](https://polyhaven.com/a/brushed_concrete) | 2.5 |  |
| `asphalt` | Clean Asphalt (`clean_asphalt`) | [Poly Haven](https://polyhaven.com/a/clean_asphalt) | 2.1 |  |
| `ceramic` | Porcelain 001 (`Porcelain001`) | [ambientCG](https://ambientcg.com/a/Porcelain001) | 0.5 (est.) | White glazed porcelain; rough ~0.07 with slight variation. Tint via material.color. |
| `plastic` | Plastic 012 A (`Plastic012A`) | [ambientCG](https://ambientcg.com/a/Plastic012A) | 0.5 (est.) | Black plastic. Roughness remapped from ~0.40 to ~0.61 mean (r = 0.35 + 0.65*r_src) for a matte look. |
| `leather` | Leather 030 (`Leather030`) | [ambientCG](https://ambientcg.com/a/Leather030) | 0.45 |  |
| `terracotta` | Clay 001 (`Clay001`) | [ambientCG](https://ambientcg.com/a/Clay001) | 1.0 (est.) | Unglazed brown/terracotta clay. |
| `soil` | Ground 048 (`Ground048`) | [ambientCG](https://ambientcg.com/a/Ground048) | 1.4 |  |
| `leaf` | Leaf 001 (`Leaf001`) | [ambientCG](https://ambientcg.com/a/Leaf001) | 0.25 (est.) | Not tileable: leaf atlas with two leaves (left/right halves) on black, plus alpha.jpg (opacity cut-out). Use alphaTest and map each leaf with UVs; not a monstera. |

Licence details: https://polyhaven.com/license and https://docs.ambientcg.com/license/
