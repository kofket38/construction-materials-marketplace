import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  PrismaClient,
  ProductApprovalStatus,
  ProductImageType,
  Role,
} from "../src/prisma/generated/client.js";
import { hashPassword } from "../src/utils/password.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

interface SellerSeed {
  id: string;
  name: string;
  email: string;
  company: string;
  shopName: string;
  phone: string;
  address: string;
  paymentAccountName: string;
  telebirrNumber: string;
  cbeBirrNumber: string;
  cbeBankAccountNumber: string;
  awashBankAccountNumber: string;
  dashenBankAccountNumber: string;
  eBirrNumber: string;
}

interface NamedSeed {
  id: string;
  name: string;
  description: string;
}

interface ProductSeed {
  id: string;
  sellerEmail: string;
  categoryName: string;
  brandName: string;
  name: string;
  summary: string;
  price: string;
  quantity: number;
  imageUrl?: string;
  inventory: {
    city: string;
    region: string;
    deliveryAvailable: boolean;
  };
  specifications: Record<string, string>;
}

const sellers: SellerSeed[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Addis Build Supply",
    email: "addis.build.supply@cmm.local",
    company: "Addis Build Supply PLC",
    shopName: "Addis Build Supply",
    phone: "+251911100101",
    address: "Akaki Kality Industrial Zone, Addis Ababa",
    paymentAccountName: "Addis Build Supply PLC",
    telebirrNumber: "0911100101",
    cbeBirrNumber: "0911100101",
    cbeBankAccountNumber: "1000011001010",
    awashBankAccountNumber: "0134011001010",
    dashenBankAccountNumber: "1800110010101",
    eBirrNumber: "0911100101",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    name: "Ethiopian Structural Materials",
    email: "structural.materials@cmm.local",
    company: "Ethiopian Structural Materials PLC",
    shopName: "Structural Materials Hub",
    phone: "+251911100202",
    address: "Dukem Industrial Corridor, Oromia",
    paymentAccountName: "Ethiopian Structural Materials PLC",
    telebirrNumber: "0911100202",
    cbeBirrNumber: "0911100202",
    cbeBankAccountNumber: "1000011002020",
    awashBankAccountNumber: "0134011002020",
    dashenBankAccountNumber: "1800110020202",
    eBirrNumber: "0911100202",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    name: "HomeWorks Finishes and Utilities",
    email: "homeworks.utilities@cmm.local",
    company: "HomeWorks Finishes and Utilities PLC",
    shopName: "HomeWorks Trade Center",
    phone: "+251911100303",
    address: "Megenagna, Addis Ababa",
    paymentAccountName: "HomeWorks Finishes and Utilities PLC",
    telebirrNumber: "0911100303",
    cbeBirrNumber: "0911100303",
    cbeBankAccountNumber: "1000011003030",
    awashBankAccountNumber: "0134011003030",
    dashenBankAccountNumber: "1800110030303",
    eBirrNumber: "0911100303",
  },
];

const categories: NamedSeed[] = [
  named(
    "20000000-0000-4000-8000-000000000001",
    "Cement",
    "Bagged cement and cementitious building materials.",
  ),
  named(
    "20000000-0000-4000-8000-000000000002",
    "Steel and Reinforcement",
    "Structural steel, reinforcement bars, and steel sections.",
  ),
  named(
    "20000000-0000-4000-8000-000000000003",
    "Masonry",
    "Blocks, bricks, and masonry construction materials.",
  ),
  named(
    "20000000-0000-4000-8000-000000000004",
    "Tiles and Flooring",
    "Ceramic, porcelain, and resilient flooring products.",
  ),
  named(
    "20000000-0000-4000-8000-000000000005",
    "Roofing",
    "Roofing sheets, panels, and roof finishing materials.",
  ),
  named(
    "20000000-0000-4000-8000-000000000006",
    "Aggregates",
    "Sand, gravel, and graded construction aggregates.",
  ),
  named(
    "20000000-0000-4000-8000-000000000007",
    "Paint and Finishes",
    "Architectural paint, coatings, and surface finishes.",
  ),
  named(
    "20000000-0000-4000-8000-000000000008",
    "Electrical",
    "Electrical cables and building electrical materials.",
  ),
  named(
    "20000000-0000-4000-8000-000000000009",
    "Plumbing",
    "Water supply, drainage, and plumbing products.",
  ),
  named(
    "20000000-0000-4000-8000-000000000010",
    "Doors and Windows",
    "Exterior and interior doors, windows, frames, and glazing systems.",
  ),
  named(
    "20000000-0000-4000-8000-000000000011",
    "Timber and Boards",
    "Structural timber, construction poles, plywood, and engineered boards.",
  ),
  named(
    "20000000-0000-4000-8000-000000000012",
    "Waterproofing",
    "Membranes, coatings, and moisture-protection building materials.",
  ),
  named(
    "20000000-0000-4000-8000-000000000013",
    "Sanitary Ware",
    "Bathroom fixtures, ceramic sanitary products, and shower fittings.",
  ),
];

const brands: NamedSeed[] = [
  named(
    "30000000-0000-4000-8000-000000000001",
    "Dangote Cement",
    "Dangote bagged cement products.",
  ),
  named(
    "30000000-0000-4000-8000-000000000002",
    "Derba Cement",
    "Derba MIDROC bagged cement products.",
  ),
  named(
    "30000000-0000-4000-8000-000000000003",
    "Habesha Cement",
    "Habesha bagged cement products.",
  ),
  named(
    "30000000-0000-4000-8000-000000000004",
    "Mugher Cement",
    "Mugher bagged cement products.",
  ),
  named(
    "30000000-0000-4000-8000-000000000005",
    "National Cement",
    "National bagged cement products.",
  ),
  named(
    "30000000-0000-4000-8000-000000000006",
    "Abyssinia Steel",
    "Structural and reinforcement steel products.",
  ),
  named(
    "30000000-0000-4000-8000-000000000007",
    "Ethio Block",
    "Concrete masonry products.",
  ),
  named(
    "30000000-0000-4000-8000-000000000008",
    "Prime Ceramics",
    "Ceramic and porcelain surface products.",
  ),
  named(
    "30000000-0000-4000-8000-000000000009",
    "Kality Metal Products",
    "Roofing and formed metal products.",
  ),
  named(
    "30000000-0000-4000-8000-000000000010",
    "Addis Aggregates",
    "Processed and naturally graded aggregates.",
  ),
  named(
    "30000000-0000-4000-8000-000000000011",
    "Rainbow Paints",
    "Architectural paints and coatings.",
  ),
  named(
    "30000000-0000-4000-8000-000000000012",
    "Ethiopian Cable",
    "Building wire and electrical cable products.",
  ),
  named(
    "30000000-0000-4000-8000-000000000013",
    "Nifas PVC",
    "PVC pressure and drainage pipe products.",
  ),
  named(
    "30000000-0000-4000-8000-000000000014",
    "Addis Brickworks",
    "Fired clay and concrete masonry products.",
  ),
  named(
    "30000000-0000-4000-8000-000000000015",
    "PrimeBond",
    "Tile-setting and surface preparation materials.",
  ),
  named(
    "30000000-0000-4000-8000-000000000016",
    "Horizon Doors",
    "Residential steel and timber door systems.",
  ),
  named(
    "30000000-0000-4000-8000-000000000017",
    "Addis Aluminium",
    "Fabricated aluminium windows and glazing systems.",
  ),
  named(
    "30000000-0000-4000-8000-000000000018",
    "Sheger Timber",
    "Construction timber, plywood, and engineered wood boards.",
  ),
  named(
    "30000000-0000-4000-8000-000000000019",
    "HydroSeal",
    "Building waterproofing membranes and coatings.",
  ),
  named(
    "30000000-0000-4000-8000-000000000020",
    "AquaSan",
    "Residential sanitary ware and bathroom fittings.",
  ),
  named(
    "30000000-0000-4000-8000-000000000021",
    "PowerSafe",
    "Residential electrical distribution and wiring accessories.",
  ),
  named(
    "30000000-0000-4000-8000-000000000022",
    "AquaFlow",
    "Water-control valves and plumbing fittings.",
  ),
];

const products: ProductSeed[] = [
  cementProduct({
    id: "40000000-0000-4000-8000-000000000001",
    name: "Dangote Cement 50kg",
    brandName: "Dangote Cement",
    price: "1280.00",
    quantity: 480,
    imageUrl: "/images/products/dangote-cement.png",
    strengthGrade: "32.5R",
    cementType: "Portland limestone cement",
    origin: "Ethiopia",
  }),
  cementProduct({
    id: "40000000-0000-4000-8000-000000000002",
    name: "Derba Cement 50kg",
    brandName: "Derba Cement",
    price: "1325.00",
    quantity: 360,
    imageUrl: "/images/products/derba-cement.png",
    strengthGrade: "42.5N",
    cementType: "Ordinary Portland cement",
    origin: "Derba, Ethiopia",
  }),
  cementProduct({
    id: "40000000-0000-4000-8000-000000000003",
    name: "Habesha Cement 50kg",
    brandName: "Habesha Cement",
    price: "1295.00",
    quantity: 420,
    imageUrl: "/images/products/habesha-cement.png",
    strengthGrade: "32.5N",
    cementType: "Portland pozzolana cement",
    origin: "Holeta, Ethiopia",
  }),
  cementProduct({
    id: "40000000-0000-4000-8000-000000000004",
    name: "Mugher Cement 50kg",
    brandName: "Mugher Cement",
    price: "1260.00",
    quantity: 310,
    imageUrl: "/images/products/mugher-cement.png",
    strengthGrade: "32.5N",
    cementType: "Portland pozzolana cement",
    origin: "Mugher, Ethiopia",
  }),
  cementProduct({
    id: "40000000-0000-4000-8000-000000000005",
    name: "National Cement 50kg",
    brandName: "National Cement",
    price: "1305.00",
    quantity: 390,
    imageUrl: "/images/products/national-cement.png",
    strengthGrade: "32.5R",
    cementType: "Portland pozzolana cement",
    origin: "Dire Dawa, Ethiopia",
  }),
  product({
    id: "40000000-0000-4000-8000-000000000006",
    seller: 1,
    categoryName: "Steel and Reinforcement",
    brandName: "Abyssinia Steel",
    name: "Reinforcement Bar 12mm Grade 60",
    summary:
      "High-yield deformed reinforcement bar for slabs, beams, columns, and reinforced concrete foundations.",
    price: "1480.00",
    quantity: 850,
    imageUrl: "/images/products/rebar-12mm.png",
    city: "Dukem",
    region: "Oromia",
    specifications: {
      Diameter: "12 mm",
      Length: "12 m",
      Grade: "60",
      Standard: "ASTM A615",
      Finish: "Deformed",
      "Minimum order": "10 bars",
      Origin: "Ethiopia",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000007",
    seller: 1,
    categoryName: "Steel and Reinforcement",
    brandName: "Abyssinia Steel",
    name: "Galvanized Steel Pipe 2 Inch",
    summary:
      "Hot-dip galvanized steel pipe for structural frames, handrails, water lines, and fabrication work.",
    price: "3850.00",
    quantity: 190,
    imageUrl: "/images/products/galvanized-steel-pipe-2-inch.png",
    city: "Dukem",
    region: "Oromia",
    specifications: {
      Diameter: "2 inch",
      Length: "6 m",
      Thickness: "2.5 mm",
      Coating: "Hot-dip galvanized",
      "Minimum order": "5 pipes",
      Origin: "Ethiopia",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000008",
    seller: 1,
    categoryName: "Masonry",
    brandName: "Ethio Block",
    name: "Hollow Concrete Block 20cm",
    summary:
      "Machine-vibrated hollow concrete block for external walls, partitions, and general masonry construction.",
    price: "115.00",
    quantity: 4200,
    imageUrl: "/images/products/hollow-concrete-block-20cm.png",
    city: "Bishoftu",
    region: "Oromia",
    specifications: {
      Dimensions: "40 x 20 x 20 cm",
      Material: "Concrete",
      Cavities: "3",
      Application: "Load-bearing and partition walls",
      "Minimum order": "100 blocks",
      Origin: "Ethiopia",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000009",
    seller: 2,
    categoryName: "Tiles and Flooring",
    brandName: "Prime Ceramics",
    name: "Porcelain Ceramic Floor Tile 60x60cm",
    summary:
      "Low-porosity porcelain floor tile with a durable matte finish for residential and commercial interiors.",
    price: "1650.00",
    quantity: 275,
    imageUrl: "/images/products/porcelain-floor-tile-60x60.png",
    specifications: {
      Dimensions: "60 x 60 cm",
      Finish: "Matte",
      Coverage: "1.44 m2 per carton",
      Packaging: "4 tiles per carton",
      Application: "Indoor floor",
      "Minimum order": "5 cartons",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000010",
    seller: 1,
    categoryName: "Roofing",
    brandName: "Kality Metal Products",
    name: "Corrugated Galvanized Roofing Sheet 0.35mm",
    summary:
      "Zinc-coated corrugated roofing sheet for residential, warehouse, workshop, and agricultural structures.",
    price: "2150.00",
    quantity: 520,
    imageUrl: "/images/products/corrugated-roofing-sheet-035.png",
    city: "Dukem",
    region: "Oromia",
    specifications: {
      Thickness: "0.35 mm",
      Length: "3 m",
      Width: "0.8 m",
      Coating: "Galvanized zinc",
      Profile: "Corrugated",
      "Minimum order": "10 sheets",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000011",
    seller: 0,
    categoryName: "Aggregates",
    brandName: "Addis Aggregates",
    name: "Washed Construction Sand 7 m3 Load",
    summary:
      "Clean washed construction sand graded for concrete production, block work, plastering, and screed.",
    price: "18500.00",
    quantity: 65,
    imageUrl: "/images/products/washed-construction-sand.png",
    specifications: {
      Volume: "7 m3",
      Grading: "0-5 mm",
      Condition: "Washed",
      Application: "Concrete, masonry, and plaster",
      Delivery: "Tipper truck load",
      "Minimum order": "1 load",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000012",
    seller: 0,
    categoryName: "Aggregates",
    brandName: "Addis Aggregates",
    name: "Crushed Gravel 20mm 7 m3 Load",
    summary:
      "Washed crushed stone aggregate for structural concrete, foundations, drainage beds, and site works.",
    price: "22400.00",
    quantity: 52,
    imageUrl: "/images/products/crushed-gravel-20mm.png",
    specifications: {
      Volume: "7 m3",
      AggregateSize: "20 mm",
      Condition: "Washed",
      Application: "Structural concrete and drainage",
      Delivery: "Tipper truck load",
      "Minimum order": "1 load",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000013",
    seller: 2,
    categoryName: "Paint and Finishes",
    brandName: "Rainbow Paints",
    name: "Interior Emulsion Paint White 20L",
    summary:
      "Low-odor water-based interior emulsion paint with a washable matt finish and strong surface coverage.",
    price: "4680.00",
    quantity: 145,
    imageUrl: "/images/products/interior-emulsion-paint-20l.png",
    specifications: {
      Volume: "20 L",
      Color: "White",
      Finish: "Matt",
      Coverage: "10-12 m2 per litre",
      Base: "Water-based acrylic",
      Packaging: "Plastic pail",
      "Minimum order": "1 pail",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000014",
    seller: 2,
    categoryName: "Electrical",
    brandName: "Ethiopian Cable",
    name: "Copper Electrical Cable 2.5mm2 100m",
    summary:
      "Single-core copper building wire for socket circuits, lighting distribution, and general concealed wiring.",
    price: "7850.00",
    quantity: 230,
    imageUrl: "/images/products/copper-cable-25mm.png",
    specifications: {
      Conductor: "Copper",
      CrossSection: "2.5 mm2",
      Length: "100 m",
      VoltageRating: "450/750 V",
      Insulation: "PVC",
      Packaging: "Coil",
      "Minimum order": "1 coil",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000015",
    seller: 2,
    categoryName: "Plumbing",
    brandName: "Nifas PVC",
    name: "PVC Pressure Pipe 4 Inch 6m",
    summary:
      "Rigid PVC pressure pipe for cold-water distribution, irrigation, and buried utility installations.",
    price: "2380.00",
    quantity: 310,
    imageUrl: "/images/products/pvc-pressure-pipe-4-inch.png",
    specifications: {
      Diameter: "4 inch",
      Length: "6 m",
      PressureClass: "PN10",
      Material: "uPVC",
      JointType: "Solvent socket",
      "Minimum order": "5 pipes",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000016",
    seller: 1,
    categoryName: "Steel and Reinforcement",
    brandName: "Abyssinia Steel",
    name: "Reinforcement Bar 16mm Grade 60",
    summary:
      "Heavy deformed reinforcement bar for columns, transfer beams, retaining walls, and reinforced foundations.",
    price: "2590.00",
    quantity: 620,
    imageUrl: "/images/products/rebar-16mm.png",
    city: "Dukem",
    region: "Oromia",
    specifications: {
      Diameter: "16 mm",
      Length: "12 m",
      Grade: "60",
      Standard: "ASTM A615",
      Finish: "Deformed",
      "Minimum order": "10 bars",
      Origin: "Ethiopia",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000017",
    seller: 1,
    categoryName: "Steel and Reinforcement",
    brandName: "Abyssinia Steel",
    name: "Annealed Binding Wire 25kg",
    summary:
      "Flexible black annealed wire for tying reinforcement cages, mesh, and general site fixing work.",
    price: "3650.00",
    quantity: 175,
    imageUrl: "/images/products/binding-wire-25kg.png",
    city: "Dukem",
    region: "Oromia",
    specifications: {
      Weight: "25 kg",
      Diameter: "1.6 mm",
      Material: "Annealed mild steel",
      Packaging: "Coil",
      Application: "Reinforcement tying",
      "Minimum order": "1 coil",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000018",
    seller: 1,
    categoryName: "Masonry",
    brandName: "Ethio Block",
    name: "Hollow Concrete Block 15cm",
    summary:
      "Machine-vibrated concrete block sized for internal partitions and non-load-bearing enclosure walls.",
    price: "92.00",
    quantity: 5100,
    imageUrl: "/images/products/hollow-concrete-block-15cm.png",
    city: "Bishoftu",
    region: "Oromia",
    specifications: {
      Dimensions: "40 x 20 x 15 cm",
      Material: "Concrete",
      Cavities: "3",
      Application: "Partition walls",
      "Minimum order": "100 blocks",
      Origin: "Ethiopia",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000019",
    seller: 1,
    categoryName: "Masonry",
    brandName: "Addis Brickworks",
    name: "Fired Clay Brick Standard Size",
    summary:
      "Kiln-fired clay masonry brick for durable wall construction, facades, garden walls, and repair work.",
    price: "38.00",
    quantity: 8900,
    imageUrl: "/images/products/fired-clay-brick.png",
    city: "Sebeta",
    region: "Oromia",
    specifications: {
      Dimensions: "24 x 11.5 x 7 cm",
      Material: "Fired clay",
      Finish: "Natural red",
      Application: "Interior and exterior masonry",
      "Minimum order": "500 bricks",
      Origin: "Ethiopia",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000020",
    seller: 2,
    categoryName: "Tiles and Flooring",
    brandName: "Prime Ceramics",
    name: "Gloss Ceramic Wall Tile 30x60cm",
    summary:
      "Easy-clean glazed ceramic wall tile for kitchens, bathrooms, utility rooms, and wet-area finishes.",
    price: "1420.00",
    quantity: 340,
    imageUrl: "/images/products/ceramic-wall-tile-30x60.png",
    specifications: {
      Dimensions: "30 x 60 cm",
      Finish: "Gloss",
      Color: "White",
      Coverage: "1.44 m2 per carton",
      Application: "Interior wall",
      "Minimum order": "5 cartons",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000021",
    seller: 2,
    categoryName: "Tiles and Flooring",
    brandName: "PrimeBond",
    name: "Cementitious Tile Adhesive 25kg",
    summary:
      "Polymer-modified cementitious adhesive for fixing ceramic and porcelain tiles to prepared floors and walls.",
    price: "1180.00",
    quantity: 290,
    imageUrl: "/images/products/tile-adhesive-25kg.png",
    specifications: {
      Weight: "25 kg",
      Color: "Grey",
      Coverage: "4-6 m2 per bag",
      Application: "Interior and exterior tile fixing",
      Packaging: "Paper bag",
      "Minimum order": "5 bags",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000022",
    seller: 1,
    categoryName: "Roofing",
    brandName: "Kality Metal Products",
    name: "Prepainted Roofing Sheet 0.40mm",
    summary:
      "Color-coated corrugated steel roofing sheet for weather-resistant residential and light-commercial roofs.",
    price: "2980.00",
    quantity: 410,
    imageUrl: "/images/products/prepainted-roofing-sheet-040.png",
    city: "Dukem",
    region: "Oromia",
    specifications: {
      Thickness: "0.40 mm",
      Length: "3 m",
      Width: "0.8 m",
      Finish: "Charcoal prepainted",
      Profile: "Corrugated",
      "Minimum order": "10 sheets",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000023",
    seller: 1,
    categoryName: "Roofing",
    brandName: "Kality Metal Products",
    name: "Galvanized Roofing Ridge Cap 3m",
    summary:
      "Folded galvanized ridge section for closing and weatherproofing the apex of pitched sheet-metal roofs.",
    price: "980.00",
    quantity: 260,
    imageUrl: "/images/products/galvanized-ridge-cap.png",
    city: "Dukem",
    region: "Oromia",
    specifications: {
      Length: "3 m",
      Thickness: "0.40 mm",
      Material: "Galvanized steel",
      WingWidth: "300 mm each side",
      Application: "Pitched roof ridge",
      "Minimum order": "5 pieces",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000024",
    seller: 0,
    categoryName: "Aggregates",
    brandName: "Addis Aggregates",
    name: "Crushed Stone Hardcore 40mm 7 m3 Load",
    summary:
      "Well-graded crushed stone for sub-base preparation, access roads, slab foundations, and site filling.",
    price: "20800.00",
    quantity: 44,
    imageUrl: "/images/products/crushed-hardcore-40mm.png",
    specifications: {
      Volume: "7 m3",
      AggregateSize: "0-40 mm",
      Condition: "Crusher run",
      Application: "Sub-base and site works",
      Delivery: "Tipper truck load",
      "Minimum order": "1 load",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000025",
    seller: 2,
    categoryName: "Paint and Finishes",
    brandName: "Rainbow Paints",
    name: "Exterior Weather Shield Paint 20L",
    summary:
      "UV- and rain-resistant acrylic exterior paint formulated for rendered masonry, blockwork, and concrete.",
    price: "6950.00",
    quantity: 118,
    imageUrl: "/images/products/exterior-weather-paint-20l.png",
    specifications: {
      Volume: "20 L",
      Color: "Off-white",
      Finish: "Low sheen",
      Coverage: "9-11 m2 per litre",
      Base: "Water-based acrylic",
      Packaging: "Plastic pail",
      "Minimum order": "1 pail",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000026",
    seller: 2,
    categoryName: "Paint and Finishes",
    brandName: "Rainbow Paints",
    name: "Alkali Resistant Masonry Primer 20L",
    summary:
      "Penetrating masonry primer that seals porous plaster and helps finish coats resist alkaline substrates.",
    price: "5220.00",
    quantity: 96,
    imageUrl: "/images/products/alkali-resistant-primer-20l.png",
    specifications: {
      Volume: "20 L",
      Color: "White",
      Finish: "Primer",
      Coverage: "10-12 m2 per litre",
      Application: "New plaster and masonry",
      Packaging: "Plastic pail",
      "Minimum order": "1 pail",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000027",
    seller: 2,
    categoryName: "Electrical",
    brandName: "Ethiopian Cable",
    name: "Copper Electrical Cable 1.5mm2 100m",
    summary:
      "PVC-insulated single-core copper wire for residential lighting circuits and low-load branch wiring.",
    price: "5480.00",
    quantity: 265,
    imageUrl: "/images/products/copper-cable-15mm.png",
    specifications: {
      Conductor: "Copper",
      CrossSection: "1.5 mm2",
      Length: "100 m",
      VoltageRating: "450/750 V",
      Insulation: "PVC",
      Packaging: "Coil",
      "Minimum order": "1 coil",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000028",
    seller: 2,
    categoryName: "Electrical",
    brandName: "PowerSafe",
    name: "12-Way Flush Distribution Board",
    summary:
      "Metal consumer unit for organizing residential branch circuits with space for main and protective breakers.",
    price: "4350.00",
    quantity: 82,
    imageUrl: "/images/products/distribution-board-12-way.png",
    specifications: {
      Ways: "12",
      Mounting: "Flush",
      Material: "Powder-coated steel",
      IngressProtection: "IP30",
      Standard: "IEC 61439",
      "Minimum order": "1 unit",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000029",
    seller: 2,
    categoryName: "Electrical",
    brandName: "PowerSafe",
    name: "Twin Switched Wall Socket 13A",
    summary:
      "White twin switched socket outlet for residential bedrooms, living rooms, kitchens, and offices.",
    price: "680.00",
    quantity: 460,
    imageUrl: "/images/products/twin-socket-13a.png",
    specifications: {
      Rating: "13 A, 250 V",
      Gang: "Twin",
      Mounting: "Flush",
      Color: "White",
      Standard: "BS 1363",
      "Minimum order": "10 pieces",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000030",
    seller: 2,
    categoryName: "Plumbing",
    brandName: "Nifas PVC",
    name: "PVC Drainage Pipe 110mm 6m",
    summary:
      "Rigid uPVC soil and waste pipe for residential drainage stacks, underground drains, and vent systems.",
    price: "1980.00",
    quantity: 285,
    imageUrl: "/images/products/pvc-drainage-pipe-110mm.png",
    specifications: {
      Diameter: "110 mm",
      Length: "6 m",
      Material: "uPVC",
      Color: "Orange",
      JointType: "Rubber ring socket",
      "Minimum order": "5 pipes",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000031",
    seller: 2,
    categoryName: "Plumbing",
    brandName: "Nifas PVC",
    name: "PPR Hot and Cold Water Pipe 25mm 4m",
    summary:
      "Heat-fusion PPR pipe for concealed hot- and cold-water distribution in kitchens, bathrooms, and utilities.",
    price: "760.00",
    quantity: 520,
    imageUrl: "/images/products/ppr-pipe-25mm.png",
    specifications: {
      Diameter: "25 mm",
      Length: "4 m",
      PressureClass: "PN20",
      Material: "PPR",
      JointType: "Heat fusion",
      "Minimum order": "10 pipes",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000032",
    seller: 2,
    categoryName: "Plumbing",
    brandName: "AquaFlow",
    name: "Brass Gate Valve 1 Inch",
    summary:
      "Full-bore brass isolation valve for residential water tanks, supply mains, pump lines, and service branches.",
    price: "1350.00",
    quantity: 180,
    imageUrl: "/images/products/brass-gate-valve-1-inch.png",
    specifications: {
      Size: "1 inch",
      Material: "Brass",
      Connection: "Female threaded",
      PressureRating: "PN16",
      Application: "Water isolation",
      "Minimum order": "2 valves",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000033",
    seller: 2,
    categoryName: "Doors and Windows",
    brandName: "Horizon Doors",
    name: "Security Steel Entrance Door 900x2100mm",
    summary:
      "Powder-coated steel entrance door set with reinforced leaf, frame, hinges, lockset, and weather seals.",
    price: "38500.00",
    quantity: 34,
    imageUrl: "/images/products/security-steel-door.png",
    specifications: {
      Dimensions: "900 x 2100 mm",
      Material: "Galvanized steel",
      Finish: "Powder-coated charcoal",
      Included: "Frame, hinges, lockset, handles",
      Handing: "Reversible before installation",
      "Minimum order": "1 set",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000034",
    seller: 2,
    categoryName: "Doors and Windows",
    brandName: "Addis Aluminium",
    name: "Aluminium Sliding Window 1200x1200mm",
    summary:
      "Two-panel glazed aluminium sliding window for bedrooms, living areas, kitchens, and stair landings.",
    price: "22800.00",
    quantity: 46,
    imageUrl: "/images/products/aluminium-sliding-window.png",
    specifications: {
      Dimensions: "1200 x 1200 mm",
      Frame: "Powder-coated aluminium",
      Glazing: "6 mm clear glass",
      Configuration: "Two-panel sliding",
      Included: "Frame, glass, latch, rollers",
      "Minimum order": "1 unit",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000035",
    seller: 2,
    categoryName: "Doors and Windows",
    brandName: "Horizon Doors",
    name: "Flush Interior Door 800x2100mm",
    summary:
      "Smooth paint-grade flush door leaf for bedrooms, stores, studies, and other dry interior spaces.",
    price: "8950.00",
    quantity: 78,
    imageUrl: "/images/products/flush-interior-door.png",
    specifications: {
      Dimensions: "800 x 2100 mm",
      Thickness: "40 mm",
      Core: "Semi-solid timber",
      Finish: "Paint-grade veneer",
      Included: "Door leaf only",
      "Minimum order": "1 leaf",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000036",
    seller: 1,
    categoryName: "Timber and Boards",
    brandName: "Sheger Timber",
    name: "Treated Eucalyptus Construction Pole 4m",
    summary:
      "Straight treated eucalyptus pole for scaffolding, temporary support, fencing, and light roof structures.",
    price: "620.00",
    quantity: 760,
    imageUrl: "/images/products/eucalyptus-poles-4m.png",
    city: "Addis Ababa",
    region: "Addis Ababa",
    specifications: {
      Length: "4 m",
      Diameter: "80-110 mm",
      Species: "Eucalyptus",
      Treatment: "Preservative treated",
      Application: "Scaffolding and temporary works",
      "Minimum order": "20 poles",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000037",
    seller: 1,
    categoryName: "Timber and Boards",
    brandName: "Sheger Timber",
    name: "Structural Plywood Sheet 18mm",
    summary:
      "General-purpose structural plywood for concrete formwork, roofing decks, cabinetry, and site fabrication.",
    price: "4950.00",
    quantity: 135,
    imageUrl: "/images/products/plywood-18mm.png",
    specifications: {
      Dimensions: "1220 x 2440 mm",
      Thickness: "18 mm",
      Grade: "BB/CC",
      Bond: "Exterior phenolic",
      Application: "Formwork and joinery",
      "Minimum order": "5 sheets",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000038",
    seller: 1,
    categoryName: "Timber and Boards",
    brandName: "Sheger Timber",
    name: "MDF Board Sheet 16mm",
    summary:
      "Smooth medium-density fibreboard for wardrobes, cabinets, shelving, wall panels, and interior joinery.",
    price: "4250.00",
    quantity: 120,
    imageUrl: "/images/products/mdf-board-16mm.png",
    specifications: {
      Dimensions: "1220 x 2440 mm",
      Thickness: "16 mm",
      Density: "720-760 kg/m3",
      Finish: "Raw smooth face",
      Application: "Interior furniture and joinery",
      "Minimum order": "5 sheets",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000039",
    seller: 2,
    categoryName: "Waterproofing",
    brandName: "HydroSeal",
    name: "Torch-On Bituminous Membrane 4mm",
    summary:
      "Polyester-reinforced torch-applied waterproofing membrane for flat roofs, balconies, and foundations.",
    price: "6850.00",
    quantity: 94,
    imageUrl: "/images/products/torch-on-membrane.png",
    specifications: {
      Thickness: "4 mm",
      RollSize: "1 x 10 m",
      Reinforcement: "Polyester",
      Finish: "Mineral film",
      Application: "Roofs and foundations",
      "Minimum order": "2 rolls",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000040",
    seller: 2,
    categoryName: "Waterproofing",
    brandName: "HydroSeal",
    name: "Cementitious Waterproofing Coating 25kg",
    summary:
      "Two-component cement-based coating for bathrooms, water tanks, balconies, retaining walls, and wet rooms.",
    price: "3950.00",
    quantity: 155,
    imageUrl: "/images/products/cementitious-waterproofing-25kg.png",
    specifications: {
      Weight: "25 kg",
      Coverage: "10-12 m2 at two coats",
      Color: "Grey",
      Application: "Concrete and masonry",
      Packaging: "Bag and liquid component",
      "Minimum order": "1 kit",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000041",
    seller: 2,
    categoryName: "Sanitary Ware",
    brandName: "AquaSan",
    name: "Close-Coupled Dual-Flush Toilet Suite",
    summary:
      "Vitreous china close-coupled toilet with dual-flush cistern, soft-close seat, and floor fixing kit.",
    price: "18900.00",
    quantity: 42,
    imageUrl: "/images/products/close-coupled-toilet.png",
    specifications: {
      Material: "Vitreous china",
      Color: "White",
      Outlet: "S-trap 250 mm",
      Flush: "3/6 L dual flush",
      Included: "Cistern, seat, fittings",
      "Minimum order": "1 suite",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000042",
    seller: 2,
    categoryName: "Sanitary Ware",
    brandName: "AquaSan",
    name: "Ceramic Pedestal Wash Basin 550mm",
    summary:
      "White vitreous china basin and pedestal set for residential bathrooms, powder rooms, and guest washrooms.",
    price: "9650.00",
    quantity: 58,
    imageUrl: "/images/products/ceramic-wash-basin.png",
    specifications: {
      Width: "550 mm",
      Material: "Vitreous china",
      Color: "White",
      TapHoles: "Single",
      Included: "Basin and pedestal",
      "Minimum order": "1 set",
    },
  }),
  product({
    id: "40000000-0000-4000-8000-000000000043",
    seller: 2,
    categoryName: "Sanitary Ware",
    brandName: "AquaSan",
    name: "Chrome Single-Lever Shower Mixer Set",
    summary:
      "Wall-mounted brass shower mixer with chrome finish, hand shower, hose, and adjustable holder.",
    price: "7350.00",
    quantity: 76,
    imageUrl: "/images/products/chrome-shower-mixer.png",
    specifications: {
      Material: "Brass body",
      Finish: "Chrome plated",
      Connection: "1/2 inch",
      Control: "Single lever",
      Included: "Mixer, handset, hose, holder",
      "Minimum order": "1 set",
    },
  }),
];

async function main(): Promise<void> {
  const passwordHash = await hashPassword("DevSeller123!");
  const sellerIds = new Map<string, string>();
  const categoryIds = new Map<string, string>();
  const brandIds = new Map<string, string>();

  for (const seller of sellers) {
    const user = await prisma.user.upsert({
      where: { email: seller.email },
      create: {
        id: seller.id,
        name: seller.name,
        email: seller.email,
        passwordHash,
        company: seller.company,
        phone: seller.phone,
        role: Role.SELLER,
        isActive: true,
        emailVerified: true,
      },
      update: {
        name: seller.name,
        company: seller.company,
        phone: seller.phone,
        role: Role.SELLER,
        isActive: true,
        emailVerified: true,
      },
    });

    await prisma.sellerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        shopName: seller.shopName,
        phone: seller.phone,
        address: seller.address,
        paymentAccountName: seller.paymentAccountName,
        telebirrNumber: seller.telebirrNumber,
        cbeBirrNumber: seller.cbeBirrNumber,
        cbeBankAccountNumber: seller.cbeBankAccountNumber,
        awashBankAccountNumber: seller.awashBankAccountNumber,
        dashenBankAccountNumber: seller.dashenBankAccountNumber,
        eBirrNumber: seller.eBirrNumber,
      },
      update: {
        shopName: seller.shopName,
        phone: seller.phone,
        address: seller.address,
        paymentAccountName: seller.paymentAccountName,
        telebirrNumber: seller.telebirrNumber,
        cbeBirrNumber: seller.cbeBirrNumber,
        cbeBankAccountNumber: seller.cbeBankAccountNumber,
        awashBankAccountNumber: seller.awashBankAccountNumber,
        dashenBankAccountNumber: seller.dashenBankAccountNumber,
        eBirrNumber: seller.eBirrNumber,
      },
    });

    sellerIds.set(seller.email, user.id);
  }

  for (const category of categories) {
    categoryIds.set(category.name, await upsertCategory(category));
  }

  for (const brand of brands) {
    brandIds.set(brand.name, await upsertBrand(brand));
  }

  for (const seed of products) {
    await upsertProduct(seed, sellerIds, categoryIds, brandIds);
  }

  console.log(
    `Seeded ${sellers.length} sellers, ${categories.length} categories, ` +
      `${brands.length} brands, and ${products.length} products.`,
  );
}

async function upsertCategory(seed: NamedSeed): Promise<string> {
  const existing = await prisma.category.findFirst({
    where: { name: { equals: seed.name, mode: "insensitive" } },
  });
  const category = existing
    ? await prisma.category.update({
        where: { id: existing.id },
        data: { name: seed.name, description: seed.description },
      })
    : await prisma.category.create({ data: seed });
  return category.id;
}

async function upsertBrand(seed: NamedSeed): Promise<string> {
  const existing = await prisma.brand.findFirst({
    where: { name: { equals: seed.name, mode: "insensitive" } },
  });
  const brand = existing
    ? await prisma.brand.update({
        where: { id: existing.id },
        data: { name: seed.name, description: seed.description },
      })
    : await prisma.brand.create({ data: seed });
  return brand.id;
}

async function upsertProduct(
  seed: ProductSeed,
  sellerIds: Map<string, string>,
  categoryIds: Map<string, string>,
  brandIds: Map<string, string>,
): Promise<void> {
  const sellerId = requiredMapValue(sellerIds, seed.sellerEmail, "seller");
  const categoryId = requiredMapValue(
    categoryIds,
    seed.categoryName,
    "category",
  );
  const brandId = requiredMapValue(brandIds, seed.brandName, "brand");
  const existing = await prisma.product.findFirst({
    where: { name: { equals: seed.name, mode: "insensitive" } },
  });
  const data = {
    sellerId,
    categoryId,
    brandId,
    createdBySellerId: sellerId,
    name: seed.name,
    description: formatDescription(seed.summary, seed.specifications),
    approvalStatus: ProductApprovalStatus.APPROVED,
    price: seed.price,
    quantity: seed.quantity,
    imageUrl: seed.imageUrl ?? null,
  };
  const record = existing
    ? await prisma.product.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.product.create({
        data: { id: seed.id, ...data },
      });

  await prisma.sellerInventory.upsert({
    where: {
      sellerId_productId: {
        sellerId,
        productId: record.id,
      },
    },
    create: {
      sellerId,
      productId: record.id,
      price: seed.price,
      quantity: seed.quantity,
      city: seed.inventory.city,
      region: seed.inventory.region,
      deliveryAvailable: seed.inventory.deliveryAvailable,
    },
    update: {
      price: seed.price,
      quantity: seed.quantity,
      city: seed.inventory.city,
      region: seed.inventory.region,
      deliveryAvailable: seed.inventory.deliveryAvailable,
    },
  });

  if (seed.imageUrl) {
    await seedPrimaryImage(record.id, seed.imageUrl);
  }
}

async function seedPrimaryImage(
  productId: string,
  imageUrl: string,
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    await transaction.productImage.updateMany({
      where: { productId, isPrimary: true },
      data: { isPrimary: false },
    });
    const existing = await transaction.productImage.findFirst({
      where: { productId, imageUrl },
    });

    if (existing) {
      await transaction.productImage.update({
        where: { id: existing.id },
        data: {
          type: ProductImageType.OFFICIAL,
          isPrimary: true,
        },
      });
      return;
    }

    await transaction.productImage.create({
      data: {
        productId,
        imageUrl,
        type: ProductImageType.OFFICIAL,
        isPrimary: true,
      },
    });
  });
}

function named(id: string, name: string, description: string): NamedSeed {
  return { id, name, description };
}

function cementProduct(input: {
  id: string;
  name: string;
  brandName: string;
  price: string;
  quantity: number;
  imageUrl: string;
  strengthGrade: string;
  cementType: string;
  origin: string;
}): ProductSeed {
  return {
    id: input.id,
    sellerEmail: sellers[0]!.email,
    categoryName: "Cement",
    brandName: input.brandName,
    name: input.name,
    summary:
      `${input.brandName} bagged cement for concrete, masonry, plastering, ` +
      "screed, and general building work.",
    price: input.price,
    quantity: input.quantity,
    imageUrl: input.imageUrl,
    inventory: defaultInventory(),
    specifications: {
      Weight: "50 kg",
      Packaging: "Paper bag",
      "Strength grade": input.strengthGrade,
      CementType: input.cementType,
      Standard: "ES 1177",
      "Minimum order": "10 bags",
      Origin: input.origin,
    },
  };
}

function product(input: {
  id: string;
  seller: number;
  categoryName: string;
  brandName: string;
  name: string;
  summary: string;
  price: string;
  quantity: number;
  imageUrl: string;
  city?: string;
  region?: string;
  specifications: Record<string, string>;
}): ProductSeed {
  const seller = sellers[input.seller];
  if (!seller) {
    throw new Error(`Unknown seller index: ${input.seller}`);
  }

  return {
    id: input.id,
    sellerEmail: seller.email,
    categoryName: input.categoryName,
    brandName: input.brandName,
    name: input.name,
    summary: input.summary,
    price: input.price,
    quantity: input.quantity,
    imageUrl: input.imageUrl,
    inventory: {
      city: input.city ?? "Addis Ababa",
      region: input.region ?? "Addis Ababa",
      deliveryAvailable: true,
    },
    specifications: input.specifications,
  };
}

function defaultInventory(): ProductSeed["inventory"] {
  return {
    city: "Addis Ababa",
    region: "Addis Ababa",
    deliveryAvailable: true,
  };
}

function formatDescription(
  summary: string,
  specifications: Record<string, string>,
): string {
  const lines = Object.entries(specifications).map(
    ([label, value]) => `${label}: ${value}`,
  );
  return `${summary}\n\nSpecifications:\n${lines.join("\n")}`;
}

function requiredMapValue(
  values: Map<string, string>,
  key: string,
  label: string,
): string {
  const value = values.get(key);
  if (!value) {
    throw new Error(`Missing seeded ${label}: ${key}`);
  }
  return value;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
