
/*
 * Logic in this file is based on
 * https://github.com/EDDiscovery/EliteDangerousCore/blob/master/EliteDangerous/JournalEvents/JournalScan_Images.cs
 */

import { CanonnBiostatsBody } from "../home/home.component";

export class BodyImage {
    private static starImages: StarImageData[] = [
        {
            path: "A",
            spectralClass: "A",
            coronaPath: "Corona_A",
        },
        {
            path: "B",
            spectralClass: "B",
            coronaPath: "Corona_B",
        },
        {
            path: "C",
            spectralClass: "C",
        },
        {
            path: "D",
            spectralClass: null,
            subType: new RegExp("^White Dwarf"),
            solarMasses: (value: number) => value >= 1,
        },
        {
            path: "D_hot",
            spectralClass: null,
            subType: new RegExp("^White Dwarf"),
            solarMasses: (value: number) => value >= 0.8,
        },
        {
            path: "D_veryHot",
            spectralClass: null,
            subType: new RegExp("^White Dwarf"),
            solarMasses: (value: number) => value >= 0.6,
        },
        {
            path: "D_extremelyHot",
            spectralClass: null,
            subType: new RegExp("^White Dwarf"),
            solarMasses: (value: number) => value < 0.6,
        },
        {
            path: "F",
            spectralClass: "F",
            coronaPath: "Corona_F",
        },
        {
            path: "G",
            spectralClass: "G",
            coronaPath: "Corona_G",
        },
        {
            path: "SuperMassiveBlackHole",
            spectralClass: null,
            subType: "Supermassive Black Hole",
        },
        {
            path: "H",
            spectralClass: null,
            subType: "Black Hole",
        },
        {
            path: "K",
            spectralClass: "K",
            coronaPath: "Corona_K",
        },
        {
            path: "L",
            spectralClass: "L",
        },
        {
            path: "M",
            spectralClass: "M",
            coronaPath: "Corona_M",
        },
        {
            path: "N",
            spectralClass: null,
            subType: "Neutron Star",
            solarMasses: (value: number) => value < 1,
        },
        {
            path: "N_massive",
            spectralClass: null,
            subType: "Neutron Star",
            solarMasses: (value: number) => value >= 1 && value <= 2,
        },
        {
            path: "N_veryMassive",
            spectralClass: null,
            subType: "Neutron Star",
            solarMasses: (value: number) => value > 2,
        },
        {
            path: "O",
            spectralClass: "O",
            coronaPath: "Corona_O",
        },
        {
            path: "T",
            spectralClass: "T",
        },
        {
            path: "Y",
            spectralClass: "Y",
        },
    ];

    private static gasGiantImages: GasGiantImageData[] = [
        // Ammonia based life
        {
            path: "GGAv8",
            giantClass: "ammonia-based life",
            maxSurfaceTemperature: 105,
        },
        {
            path: "GGAv11",
            giantClass: "ammonia-based life",
            maxSurfaceTemperature: 110,
        },
        {
            path: "GGAv9",
            giantClass: "ammonia-based life",
            maxSurfaceTemperature: 115,
        },
        {
            path: "GGAv2",
            giantClass: "ammonia-based life",
            maxSurfaceTemperature: 120,
        },
        {
            path: "GGAv12",
            giantClass: "ammonia-based life",
            maxSurfaceTemperature: 124,
        },
        {
            path: "GGAv14",
            giantClass: "ammonia-based life",
            maxSurfaceTemperature: 128,
        },
        {
            path: "GGAv7",
            giantClass: "ammonia-based life",
            maxSurfaceTemperature: 130,
        },
        {
            path: "GGAv13",
            giantClass: "ammonia-based life",
            maxSurfaceTemperature: 134,
        },
        {
            path: "GGAv6",
            giantClass: "ammonia-based life",
            maxSurfaceTemperature: 138,
        },
        {
            path: "GGAv1",
            giantClass: "ammonia-based life",
            maxSurfaceTemperature: 142,
        },
        {
            path: "GGAv3",
            giantClass: "ammonia-based life",
            maxSurfaceTemperature: 148,
        },
        {
            path: "GGAv5",
            giantClass: "ammonia-based life",
            maxSurfaceTemperature: 152,
        },
        {
            path: "GGAv4",
            giantClass: "ammonia-based life",
        },
        // Water based life
        {
            path: "GGWv24",
            giantClass: "water-based life",
            maxSurfaceTemperature: 152,
        },
        {
            path: "GGWv1",
            giantClass: "water-based life",
            maxSurfaceTemperature: 155,
            atmosphere: ["oxygen"],
        },
        {
            path: "GGWv16",
            giantClass: "water-based life",
            maxSurfaceTemperature: 155,
        },
        {
            path: "GGWv3",
            giantClass: "water-based life",
            maxSurfaceTemperature: 158,
        },
        {
            path: "GGWv14",
            giantClass: "water-based life",
            maxSurfaceTemperature: 160,
        },
        {
            path: "GGWv22",
            giantClass: "water-based life",
            maxSurfaceTemperature: 162,
        },
        {
            path: "GGWv20",
            giantClass: "water-based life",
            maxSurfaceTemperature: 165,
        },
        {
            path: "GGWv25",
            giantClass: "water-based life",
            maxSurfaceTemperature: 172,
        },
        {
            path: "GGWv2",
            giantClass: "water-based life",
            maxSurfaceTemperature: 175,
        },
        {
            path: "GGWv13",
            giantClass: "water-based life",
            maxSurfaceTemperature: 180,
        },
        {
            path: "GGWv9",
            giantClass: "water-based life",
            maxSurfaceTemperature: 185,
        },
        {
            path: "GGWv21",
            giantClass: "water-based life",
            maxSurfaceTemperature: 190,
        },
        {
            path: "GGWv7",
            giantClass: "water-based life",
            maxSurfaceTemperature: 200,
        },
        {
            path: "GGWv8",
            giantClass: "water-based life",
            maxSurfaceTemperature: 205,
        },
        {
            path: "GGWv15",
            giantClass: "water-based life",
            maxSurfaceTemperature: 210,
        },
        {
            path: "GGWv17",
            giantClass: "water-based life",
            maxSurfaceTemperature: 213,
        },
        {
            path: "GGWv6",
            giantClass: "water-based life",
            maxSurfaceTemperature: 216,
        },
        {
            path: "GGWv18",
            giantClass: "water-based life",
            maxSurfaceTemperature: 219,
        },
        {
            path: "GGWv10",
            giantClass: "water-based life",
            maxSurfaceTemperature: 222,
        },
        {
            path: "GGWv11",
            giantClass: "water-based life",
            maxSurfaceTemperature: 225,
        },
        {
            path: "GGWv23",
            giantClass: "water-based life",
            maxSurfaceTemperature: 228,
        },
        {
            path: "GGWv5",
            giantClass: "water-based life",
            maxSurfaceTemperature: 232,
        },
        {
            path: "GGWv12",
            giantClass: "water-based life",
            maxSurfaceTemperature: 236,
        },
        {
            path: "GGWv19",
            giantClass: "water-based life",
            atmosphere: ["oxygen"],
        },
        {
            path: "GGWv4",
            giantClass: "water-based life",
        },
        // Helium
        {
            path: "GGHv7",
            giantClass: "helium",
            maxSurfaceTemperature: 110,
            atmosphere: ["antimony", "cadmium", "niobium"]
        },
        {
            path: "GGHv3",
            giantClass: "helium",
            maxSurfaceTemperature: 110,
        },
        {
            path: "GGHv6",
            giantClass: "helium",
            maxSurfaceTemperature: 125,
        },
        {
            path: "GGHv2",
            giantClass: "helium",
            maxSurfaceTemperature: 140,
        },
        {
            path: "GGHv5",
            giantClass: "helium",
            maxSurfaceTemperature: 180,
        },
        {
            path: "GGHv4",
            giantClass: "helium",
            maxSurfaceTemperature: 270,
        },
        {
            path: "GGHv1",
            giantClass: "helium",
            maxSurfaceTemperature: 600,
        },
        {
            path: "GGHv9",
            giantClass: "helium",
            maxSurfaceTemperature: 700,
        },
        {
            path: "GGHv8",
            giantClass: "helium",
        },
        // Water
        {
            path: "WTGv6",
            giantClass: "water",
            maxSurfaceTemperature: 155,
        },
        {
            path: "WTGv2",
            giantClass: "water",
            maxSurfaceTemperature: 160,
        },
        {
            path: "WTGv1",
            giantClass: "water",
            maxSurfaceTemperature: 165,
        },
        {
            path: "WTGv3",
            giantClass: "water",
            maxSurfaceTemperature: 170,
        },
        {
            path: "WTGv4",
            giantClass: "water",
            maxSurfaceTemperature: 180,
        },
        {
            path: "WTGv5",
            giantClass: "water",
            maxSurfaceTemperature: 190,
        },
        {
            path: "WTGv7",
            giantClass: "water",
        },
        // Class 1 giants
        {
            path: "GG1v12",
            giantClass: 1,
            maxSurfaceTemperature: 30,
        },
        {
            path: "GG1v15",
            giantClass: 1,
            maxSurfaceTemperature: 35,
        },
        {
            path: "GG1v13",
            giantClass: 1,
            maxSurfaceTemperature: 40,
        },
        {
            path: "GG1v4",
            giantClass: 1,
            maxSurfaceTemperature: 45,
        },
        {
            path: "GG1v9",
            giantClass: 1,
            maxSurfaceTemperature: 50,
        },
        {
            path: "GG1v2",
            giantClass: 1,
            maxSurfaceTemperature: 55,
        },
        {
            path: "GG1v16",
            giantClass: 1,
            maxSurfaceTemperature: 60,
        },
        {
            path: "GG1v19",
            giantClass: 1,
            maxSurfaceTemperature: 65,
        },
        {
            path: "GG1v18",
            giantClass: 1,
            maxSurfaceTemperature: 70,
        },
        {
            path: "GG1v11",
            giantClass: 1,
            maxSurfaceTemperature: 80,
        },
        {
            path: "GG1v3",
            giantClass: 1,
            maxSurfaceTemperature: 85,
        },
        {
            path: "GG1v6",
            giantClass: 1,
            maxSurfaceTemperature: 90,
        },
        {
            path: "GG1v8",
            giantClass: 1,
            maxSurfaceTemperature: 100,
        },
        {
            path: "GG1v1",
            giantClass: 1,
            maxSurfaceTemperature: 110,
        },
        {
            path: "GG1v5",
            giantClass: 1,
            maxSurfaceTemperature: 130,
        },
        {
            path: "GG1v17",
            giantClass: 1,
            maxSurfaceTemperature: 135,
        },
        {
            path: "GG1v20",
            giantClass: 1,
            maxSurfaceTemperature: 140,
        },
        {
            path: "GG1v14",
            giantClass: 1,
            maxSurfaceTemperature: 150,
        },
        {
            path: "GG1v7",
            giantClass: 1,
            maxSurfaceTemperature: 170,
        },
        {
            path: "GG1v10",
            giantClass: 1,
        },
        // Class 2 giant
        {
            path: "GG2v4",
            giantClass: 2,
            maxSurfaceTemperature: 160,
        },
        {
            path: "GG2v7",
            giantClass: 2,
            maxSurfaceTemperature: 175,
        },
        {
            path: "GG2v5",
            giantClass: 2,
            maxSurfaceTemperature: 200,
        },
        {
            path: "GG2v8",
            giantClass: 2,
            maxSurfaceTemperature: 245,
        },
        {
            path: "GG2v6",
            giantClass: 2,
            maxSurfaceTemperature: 260,
        },
        {
            path: "GG2v1",
            giantClass: 2,
            maxSurfaceTemperature: 275,
        },
        {
            path: "GG2v2",
            giantClass: 2,
            maxSurfaceTemperature: 300,
        },
        {
            path: "GG2v3",
            giantClass: 2,
        },
        // Class 3 giants
        {
            path: "GG3v2",
            giantClass: 3,
            maxSurfaceTemperature: 300,
        },
        {
            path: "GG3v3",
            giantClass: 3,
            maxSurfaceTemperature: 340,
        },
        {
            path: "GG3v12",
            giantClass: 3,
            maxSurfaceTemperature: 370,
        },
        {
            path: "GG3v1",
            giantClass: 3,
            maxSurfaceTemperature: 400,
        },
        {
            path: "GG3v5",
            giantClass: 3,
            maxSurfaceTemperature: 500,
        },
        {
            path: "GG3v4",
            giantClass: 3,
            maxSurfaceTemperature: 570,
        },
        {
            path: "GG3v8",
            giantClass: 3,
            maxSurfaceTemperature: 600,
        },
        {
            path: "GG3v10",
            giantClass: 3,
            maxSurfaceTemperature: 620,
        },
        {
            path: "GG3v7",
            giantClass: 3,
            maxSurfaceTemperature: 660,
        },
        {
            path: "GG3v9",
            giantClass: 3,
            maxSurfaceTemperature: 700,
        },
        {
            path: "GG3v11",
            giantClass: 3,
            maxSurfaceTemperature: 745,
        },
        {
            path: "GG3v13",
            giantClass: 3,
            maxSurfaceTemperature: 760,
        },
        {
            path: "GG3v6",
            giantClass: 3,
        },
        // Class 4 giants
        {
            path: "GG4v9",
            giantClass: 4,
            maxSurfaceTemperature: 810,
        },
        {
            path: "GG4v6",
            giantClass: 4,
            maxSurfaceTemperature: 830,
        },
        {
            path: "GG4v4",
            giantClass: 4,
            maxSurfaceTemperature: 880,
        },
        {
            path: "GG4v10",
            giantClass: 4,
            maxSurfaceTemperature: 950,
        },
        {
            path: "GG4v3",
            giantClass: 4,
            maxSurfaceTemperature: 1010,
        },
        {
            path: "GG4v1",
            giantClass: 4,
            maxSurfaceTemperature: 1070,
        },
        {
            path: "GG4v7",
            giantClass: 4,
            maxSurfaceTemperature: 1125,
        },
        {
            path: "GG4v2",
            giantClass: 4,
            maxSurfaceTemperature: 1200,
        },
        {
            path: "GG4v13",
            giantClass: 4,
            maxSurfaceTemperature: 1220,
        },
        {
            path: "GG4v11",
            giantClass: 4,
            maxSurfaceTemperature: 1240,
        },
        {
            path: "GG4v8",
            giantClass: 4,
            maxSurfaceTemperature: 1270,
        },
        {
            path: "GG4v12",
            giantClass: 4,
            maxSurfaceTemperature: 1300,
        },
        {
            path: "GG4v5",
            giantClass: 4,
        },
        // Class 5 giants
        {
            path: "GG5v3",
            giantClass: 5,
            maxSurfaceTemperature: 1600,
        },
        {
            path: "GG5v4",
            giantClass: 5,
            maxSurfaceTemperature: 1620,
        },
        {
            path: "GG5v1",
            giantClass: 5,
            maxSurfaceTemperature: 1700,
        },
        {
            path: "GG5v2",
            giantClass: 5,
            maxSurfaceTemperature: 1850,
        },
        {
            path: "GG5v5",
            giantClass: 5,

        },
    ];

    private static terrestrialBodyImages: TerrestrialBodyImageData[] = [
        // Ammonia world
        {
            path: "AMWv2",
            subType: "Ammonia world",
            terraformable: true,
        },
        {
            path: "AMWv3",
            subType: "Ammonia world",
            atmosphere: ["thick", "hot"],
        },
        {
            path: "AMWv4",
            subType: "Ammonia world",
            atmosphere: ["rich"],
        },
        {
            path: "AMWv5",
            subType: "Ammonia world",
            atmosphere: true,
            landable: true,
            maxSurfaceTemperature: 140,
        },
        {
            path: "AMWv6",
            subType: "Ammonia world",
            maxSurfaceTemperature: 190,
        },
        {
            path: "AMWv3",
            subType: "Ammonia world",
            maxSurfaceTemperature: 200,
        },
        {
            path: "AMWv1",
            subType: "Ammonia world",
            maxSurfaceTemperature: 210,
        },
        {
            path: "AMWv4",
            subType: "Ammonia world",
        },
        // Earth-like worlds
        {
            path: "ELWv1",
            subType: "Earth-like world",
            isApplicable: (body: CanonnBiostatsBody) => body.earthMasses == 1 && body.surfaceTemperature == 288,
        },
        {
            path: "ELWv7",
            subType: "Earth-like world",
            tidallyLocked: true,
        },
        {
            path: "ELWv4",
            subType: "Earth-like world",
            maxEarthMasses: 0.15,
            maxSurfaceTemperature: 262,
        },
        {
            path: "ELWv8",
            subType: "Earth-like world",
            maxSurfaceTemperature: 270,
        },
        {
            path: "ELWv2",
            subType: "Earth-like world",
            maxSurfaceTemperature: 285,
        },
        {
            path: "ELWv3",
            subType: "Earth-like world",
            maxSurfaceTemperature: 300,
        },
        {
            path: "ELWv5",
            subType: "Earth-like world",
        },
        // High metal content
        {
            path: "HMCv30",
            subType: "High metal content world",
            atmosphere: false,
            maxSurfaceTemperature: 300,
            tidallyLocked: true,
        },
        {
            path: "HMCv27",
            subType: "High metal content world",
            atmosphere: false,
            maxSurfaceTemperature: 300,
            tidallyLocked: false,
        },
        {
            path: "HMCv34",
            subType: "High metal content world",
            atmosphere: false,
            maxSurfaceTemperature: 500,
        },
        {
            path: "HMCv32",
            subType: "High metal content world",
            atmosphere: false,
            maxSurfaceTemperature: 700,
        },
        {
            path: "HMCv31",
            subType: "High metal content world",
            atmosphere: false,
            maxSurfaceTemperature: 900,
        },
        {
            path: "HMCv33",
            subType: "High metal content world",
            atmosphere: false,
            maxSurfaceTemperature: 1000,
            tidallyLocked: true,
        },
        {
            path: "HMCv35",
            subType: "High metal content world",
            atmosphere: false,
            maxSurfaceTemperature: 1000,
            tidallyLocked: false,
        },
        {
            path: "HMCv36",
            subType: "High metal content world",
            atmosphere: false,
        },
        {
            path: "HMCv29",
            subType: "High metal content world",
            atmosphere: ["ammonia"],
            tidallyLocked: true,
        },
        {
            path: "HMCv17",
            subType: "High metal content world",
            atmosphere: ["ammonia"],
            tidallyLocked: false,
        },
        {
            path: "HMCv26",
            subType: "High metal content world",
            atmosphere: ["argon"],
        },
        {
            path: "HMCv9",
            subType: "High metal content world",
            atmosphere: ["carbon dioxide"],
            maxSurfaceTemperature: 220,
        },
        {
            path: "HMCv12",
            subType: "High metal content world",
            atmosphere: ["carbon dioxide"],
            maxSurfaceTemperature: 250,
        },
        {
            path: "HMCv6",
            subType: "High metal content world",
            atmosphere: ["carbon dioxide"],
            maxSurfaceTemperature: 285,
        },
        {
            path: "HMCv28",
            subType: "High metal content world",
            atmosphere: ["carbon dioxide"],
            maxSurfaceTemperature: 350,
        },
        {
            path: "HMCv7",
            subType: "High metal content world",
            atmosphere: ["carbon dioxide"],
            maxSurfaceTemperature: 400,
            tidallyLocked: true,
        },
        {
            path: "HMCv8",
            subType: "High metal content world",
            atmosphere: ["carbon dioxide"],
            maxSurfaceTemperature: 400,
            tidallyLocked: false,
        },
        {
            path: "HMCv1",
            subType: "High metal content world",
            atmosphere: ["carbon dioxide"],
            maxSurfaceTemperature: 600,
            tidallyLocked: true,
        },
        {
            path: "HMCv24",
            subType: "High metal content world",
            atmosphere: ["carbon dioxide"],
            maxSurfaceTemperature: 600,
            tidallyLocked: false,
        },
        {
            path: "HMCv3",
            subType: "High metal content world",
            atmosphere: ["carbon dioxide"],
            maxSurfaceTemperature: 700,
        },
        {
            path: "HMCv25",
            subType: "High metal content world",
            atmosphere: ["carbon dioxide"],
            maxSurfaceTemperature: 900,
        },
        {
            path: "HMCv18",
            subType: "High metal content world",
            atmosphere: ["carbon dioxide"],
            maxSurfaceTemperature: 1250,
        },
        {
            path: "HMCv14",
            subType: "High metal content world",
            atmosphere: ["carbon dioxide"],
        },
        {
            path: "HMCv19",
            subType: "High metal content world",
            atmosphere: ["methane"],
            tidallyLocked: true,

        },
        {
            path: "HMCv11",
            subType: "High metal content world",
            atmosphere: ["methane"],
            tidallyLocked: false,
        },
        {
            path: "HMCv2",
            subType: "High metal content world",
            atmosphere: ["nitrogen"],
            maxSurfaceTemperature: 200,
        },
        {
            path: "HMCv5",
            subType: "High metal content world",
            atmosphere: ["nitrogen"],
        },
        {
            path: "HMCv23",
            subType: "High metal content world",
            atmosphere: ["sulphur dioxide"],
            maxSurfaceTemperature: 700,
        },
        {
            path: "HMCv37",
            subType: "High metal content world",
            atmosphere: ["sulphur dioxide"],
        },
        {
            path: "HMCv4",
            subType: "High metal content world",
            atmosphere: ["water"],
            maxSurfaceTemperature: 400,
        },
        {
            path: "HMCv13",
            subType: "High metal content world",
            atmosphere: ["water"],
            maxSurfaceTemperature: 700,
        },
        {
            path: "HMCv16",
            subType: "High metal content world",
            atmosphere: ["water"],
            maxSurfaceTemperature: 1000,
        },
        {
            path: "HMCv20",
            subType: "High metal content world",
            atmosphere: ["water"],
        },
        {
            path: "HMCv3",
            subType: "High metal content world",
        },
        // Icy bodies
        {
            path: "ICYv7",
            subType: "Icy body",
            landable: true,
        },
        {
            path: "ICYv10",
            subType: "Icy body",
            atmosphere: ["helium"],
        },
        {
            path: "ICYv6",
            subType: "Icy body",
            atmosphere: ["neon"],
            maxSurfaceTemperature: 55,
        },
        {
            path: "ICYv9",
            subType: "Icy body",
            atmosphere: ["neon"],
        },
        {
            path: "ICYv1",
            subType: "Icy body",
            atmosphere: ["argon"],
            maxSurfaceTemperature: 100,
        },
        {
            path: "ICYv5",
            subType: "Icy body",
            atmosphere: ["argon"],
        },
        {
            path: "ICYv2",
            subType: "Icy body",
            atmosphere: ["nitrogen"],
            maxSurfaceTemperature: 105,
        },
        {
            path: "ICYv3",
            subType: "Icy body",
            atmosphere: ["nitrogen"],
            maxSurfaceTemperature: 150,
        },
        {
            path: "ICYv4",
            subType: "Icy body",
            atmosphere: ["nitrogen"],
        },
        {
            path: "ICYv3",
            subType: "Icy body",
            atmosphere: ["methane"],
            tidallyLocked: true,
        },
        {
            path: "ICYv8",
            subType: "Icy body",
            atmosphere: ["methane"],
            tidallyLocked: false,
        },
        {
            path: "ICYv5",
            subType: "Icy body",
        },
        // Metal-rich bodies
        {
            path: "MRBv7",
            subType: "Metal-rich body",
            maxSurfaceTemperature: 1000,
            landable: true,
        },
        {
            path: "MRBv2",
            subType: "Metal-rich body",
            maxSurfaceTemperature: 1200,
            landable: true,
        },
        {
            path: "MRBv12",
            subType: "Metal-rich body",
            maxSurfaceTemperature: 2000,
            landable: true,
        },
        {
            path: "MRBv8",
            subType: "Metal-rich body",
            landable: true,
        },
        {
            path: "MRBv9",
            subType: "Metal-rich body",
            maxSurfaceTemperature: 1600,
        },
        {
            path: "MRBv3",
            subType: "Metal-rich body",
            maxSurfaceTemperature: 1800,
        },
        {
            path: "MRBv4",
            subType: "Metal-rich body",
            maxSurfaceTemperature: 1900,
        },
        {
            path: "MRBv10",
            subType: "Metal-rich body",
            maxSurfaceTemperature: 2000,
        },
        {
            path: "MRBv11",
            subType: "Metal-rich body",
            maxSurfaceTemperature: 2200,
        },
        {
            path: "MRBv14",
            subType: "Metal-rich body",
            maxSurfaceTemperature: 2400,
        },
        {
            path: "MRBv8",
            subType: "Metal-rich body",
            maxSurfaceTemperature: 2600,
        },
        {
            path: "MRBv13",
            subType: "Metal-rich body",
            maxSurfaceTemperature: 3500,
        },
        {
            path: "MRBv1",
            subType: "Metal-rich body",
            maxSurfaceTemperature: 5000,
        },
        {
            path: "MRBv5",
            subType: "Metal-rich body",
            maxSurfaceTemperature: 6000,
        },
        {
            path: "MRBv6",
            subType: "Metal-rich body",
        },
        // Rocky bodies
        {
            path: "RBDv6",
            subType: "Rocky body",
            landable: false,
            isApplicable: (body: CanonnBiostatsBody) => body.surfaceTemperature == 55,
        },
        {
            path: "RBDv2",
            subType: "Rocky body",
            maxSurfaceTemperature: 150,
        },
        {
            path: "RBDv1",
            subType: "Rocky body",
            maxSurfaceTemperature: 300,
        },
        {
            path: "RBDv3",
            subType: "Rocky body",
            maxSurfaceTemperature: 400,
        },
        {
            path: "RBDv4",
            subType: "Rocky body",
            maxSurfaceTemperature: 500,
        },
        {
            path: "RBDv5",
            subType: "Rocky body",
        },
        // Rocky Ice worlds
        {
            path: "RIBv3",
            subType: "Rocky Ice world",
            tidallyLocked: true,
        },
        {
            path: "RIBv4",
            subType: "Rocky Ice world",
            atmosphere: true,
            isApplicable: (body: CanonnBiostatsBody) => !!body.atmosphereType && body.atmosphereType.includes("thick") && body.atmosphereType.includes("rich"),
        },
        {
            path: "RIBv1",
            subType: "Rocky Ice world",
            atmosphere: true,
            isApplicable: (body: CanonnBiostatsBody) => !!body.atmosphereType && body.atmosphereType.includes("hot") && body.atmosphereType.includes("thin"),
        },
        {
            path: "RIBv1",
            subType: "Rocky Ice world",
            maxSurfaceTemperature: 50,
        },
        {
            path: "RIBv2",
            subType: "Rocky Ice world",
            maxSurfaceTemperature: 150,
        },
        {
            path: "RIBv4",
            subType: "Rocky Ice world",
        },
        // Water worlds
        {
            path: "WTRv10",
            subType: "Water world",
            atmosphere: false,
        },
        {
            path: "WTRv6",
            subType: "Water world",
            atmosphere: ["carbon dioxide"],
            maxSurfaceTemperature: 260,
        },
        {
            path: "WTRv5",
            subType: "Water world",
            atmosphere: ["carbon dioxide"],
            maxSurfaceTemperature: 280,
        },
        {
            path: "WTRv7",
            subType: "Water world",
            atmosphere: ["carbon dioxide"],
            maxSurfaceTemperature: 300,
        },
        {
            path: "WTRv2",
            subType: "Water world",
            atmosphere: ["carbon dioxide"],
            maxSurfaceTemperature: 400,
        },
        {
            path: "WTRv11",
            subType: "Water world",
            atmosphere: ["carbon dioxide"],
        },
        {
            path: "WTRv12",
            subType: "Water world",
            atmosphere: ["ammonia"],
            tidallyLocked: true,
        },
        {
            path: "WTRv1",
            subType: "Water world",
            atmosphere: ["ammonia"],
            maxSurfaceTemperature: 275,
        },
        {
            path: "WTRv13",
            subType: "Water world",
            atmosphere: ["ammonia"],
            maxSurfaceTemperature: 350,
        },
        {
            path: "WTRv9",
            subType: "Water world",
            atmosphere: ["ammonia"],
            maxSurfaceTemperature: 380,
        },
        {
            path: "WTRv4",
            subType: "Water world",
            atmosphere: ["ammonia"],
        },
        {
            path: "WTRv3",
            subType: "Water world",
            atmosphere: ["nitrogen"],
            maxSurfaceTemperature: 250,
        },
        {
            path: "WTRv8",
            subType: "Water world",
            atmosphere: ["nitrogen"],
        },
        {
            path: "WTRv7",
            subType: "Water world",
        },
    ];

    public static getBodyImagePath(body: CanonnBiostatsBody): BodyImageData | null {
        if (body.type === "Star") {
            const spectralClass = body.spectralClass?.substring(0, 1) ?? null;
            for (const starImage of this.starImages) {
                if (starImage.spectralClass !== spectralClass) {
                    continue;
                }
                if (starImage.subType) {
                    if (starImage.subType instanceof RegExp) {
                        if (!starImage.subType.test(body.subType)) {
                            continue;
                        }
                    }
                    else if (starImage.subType !== body.subType) {
                        continue;
                    }
                }
                if (starImage.solarMasses && !starImage.solarMasses(body.solarMasses ?? 0)) {
                    continue;
                }
                return {
                    path: "stars/" + starImage.path,
                    coronaPath: starImage.coronaPath ? "stars/" + starImage.coronaPath : undefined,
                };
            }
        }
        else if (body.type === "Planet") {
            if (body.subType.includes("giant")) {
                let giantClass: number | "ammonia-based life" | "water-based life" | "helium" | "water" = 0;
                const classMatch = body.subType.match(/Class ([a-z]+) gas giant/i);
                if (classMatch && classMatch.length >= 1) {
                    switch (classMatch[1]) {
                        case "I": {
                            giantClass = 1;
                            break;
                        }
                        case "II": {
                            giantClass = 2;
                            break;
                        }
                        case "III": {
                            giantClass = 3;
                            break;
                        }
                        case "IV": {
                            giantClass = 4;
                            break;
                        }
                        case "V": {
                            giantClass = 5;
                            break;
                        }
                    }
                }
                else if (body.subType.includes("water-based life")) {
                    giantClass = "water-based life";
                }
                else if (body.subType.includes("ammonia-based life")) {
                    giantClass = "ammonia-based life";
                }
                else if (body.subType == "Helium gas giant" || body.subType == "Helium-rich gas giant") {
                    giantClass = "helium";
                }
                else if (body.subType == "Water giant") {
                    giantClass = "water";
                }
                for (const gasGiantImage of this.gasGiantImages) {
                    if (gasGiantImage.giantClass !== giantClass) {
                        continue;
                    }
                    if (gasGiantImage.maxSurfaceTemperature && (body.surfaceTemperature ?? 0) > gasGiantImage.maxSurfaceTemperature) {
                        continue;
                    }
                    if (gasGiantImage.atmosphere) {
                        if (!body.atmosphereType) {
                            continue;
                        }
                        const atmosphereType = body.atmosphereType.toLowerCase();
                        if (gasGiantImage.atmosphere.findIndex(a => atmosphereType.includes(a)) === -1) {
                            continue;
                        }
                    }
                    return {
                        path: "planets/giant/" + gasGiantImage.path,
                    };
                }
            }
            else {
                for (const terrestrialBodyImage of this.terrestrialBodyImages) {
                    if (terrestrialBodyImage.subType !== body.subType) {
                        continue;
                    }
                    if (terrestrialBodyImage.maxSurfaceTemperature && (body.surfaceTemperature ?? 0) > terrestrialBodyImage.maxSurfaceTemperature) {
                        continue;
                    }
                    if (terrestrialBodyImage.maxEarthMasses && (body.earthMasses ?? 0) > terrestrialBodyImage.maxEarthMasses) {
                        continue;
                    }
                    if (typeof terrestrialBodyImage.atmosphere != 'undefined') {
                        if (typeof terrestrialBodyImage.atmosphere === 'boolean') {
                            if (terrestrialBodyImage.atmosphere !== !!body.atmosphereType) {
                                continue;
                            }
                        }
                        else {
                            if (!body.atmosphereType) {
                                continue;
                            }
                            const atmosphereType = body.atmosphereType.toLowerCase();
                            if (terrestrialBodyImage.atmosphere.findIndex(t => atmosphereType.includes(t)) === -1) {
                                continue;
                            }
                        }
                    }
                    if (typeof terrestrialBodyImage.landable != 'undefined' && terrestrialBodyImage.landable !== !!body.isLandable) {
                        continue;
                    }
                    if (typeof terrestrialBodyImage.tidallyLocked != 'undefined' && terrestrialBodyImage.tidallyLocked !== !!body.rotationalPeriodTidallyLocked) {
                        continue;
                    }
                    if (terrestrialBodyImage.isApplicable && !terrestrialBodyImage.isApplicable(body)) {
                        continue;
                    }
                    return {
                        path: "planets/terrestrial/" + terrestrialBodyImage.path,
                    };
                }
            }
        }
        return null;
    }
}

interface BodyImageData {
    path: string;
    coronaPath?: string;
}

interface StarImageData extends BodyImageData {
    spectralClass: string | null;
    subType?: string | RegExp;
    solarMasses?: (p: number) => boolean;
}

interface GasGiantImageData extends BodyImageData {
    giantClass: number | "ammonia-based life" | "water-based life" | "helium" | "water";
    maxSurfaceTemperature?: number;
    atmosphere?: string[];
}

interface TerrestrialBodyImageData extends BodyImageData {
    subType: string;
    maxSurfaceTemperature?: number;
    terraformable?: boolean;
    atmosphere?: string[] | boolean;
    landable?: boolean;
    tidallyLocked?: boolean;
    isApplicable?: (body: CanonnBiostatsBody) => boolean;
    maxEarthMasses?: number;
}