export interface MiningResource {
    name: string;
    type: 'Gemstone' | 'Mineral' | 'Metal' | 'Fuel';
    rarity: string;
    commodityCategory: string;
    description: string;
}

export const MINING_RESOURCES: { [key: string]: MiningResource } = {
    "Alexandrite": {
        "name": "Alexandrite",
        "type": "Gemstone",
        "rarity": "Rare",
        "commodityCategory": "Minerals",
        "description": "Alexandrite is a form of chrysoberyl characterised by the fact that it exhibits different colours when viewed from different angles and under different light conditions. — In-Game Description"
    },
    "Benitoite": {
        "name": "Benitoite",
        "type": "Gemstone",
        "rarity": "Rare",
        "commodityCategory": "Minerals",
        "description": "Benitoite is a blue barium titanium silicate mineral that appears fluorescent under shortwave ultraviolet light. — In-Game Description"
    },
    "Bromellite": {
        "name": "Bromellite",
        "type": "Mineral",
        "rarity": "Uncommon",
        "commodityCategory": "Minerals",
        "description": "Bromellite, BeO, is a white oxide mineral with a wide range of uses, such as ceramic based electronics, and enhancing material properties of mechanical strength and thermal conductivity. — In-Game Description"
    },
    "Grandidierite": {
        "name": "Grandidierite",
        "type": "Gemstone",
        "rarity": "Very Rare",
        "commodityCategory": "Minerals",
        "description": "Grandidierite is bluish-green nesosilicate mineral distinguished by the fact that it exhibits different colours when viewed from different angles. — In-Game Description"
    },
    "LowTemperatureDiamond": {
        "name": "Low Temperature Diamond",
        "type": "Gemstone",
        "rarity": "Very Rare",
        "commodityCategory": "Minerals",
        "description": "Low Temperature Diamonds, C, are formed under intense pressure (as with regular diamonds), but without a heat component. — In-Game Description"
    },
    "Monazite": {
        "name": "Monazite",
        "type": "Mineral",
        "rarity": "Rare",
        "commodityCategory": "Minerals",
        "description": "Monazite is a reddish-brown phosphate mineral containing thorium and sometimes uranium, making it radioactive. — In-Game Description"
    },
    "Musgravite": {
        "name": "Musgravite",
        "type": "Gemstone",
        "rarity": "Very Rare",
        "commodityCategory": "Minerals",
        "description": "Musgravite is an oxide mineral first discovered on Earth in the Musgrave mountain range in Australia, hence its name. — In-Game Description"
    },
    "Opal": {
        "name": "Void Opal",
        "type": "Gemstone",
        "rarity": "Very Rare",
        "commodityCategory": "Minerals",
        "description": "Void opals are a mineraloid prized by various cultures. Their lack of reflectivity means that they seem almost to absorb light, hence their name. — In-Game Description"
    },
    "Painite": {
        "name": "Painite",
        "type": "Gemstone",
        "rarity": "Very Rare",
        "commodityCategory": "Minerals",
        "description": "Painite is an incredibly rare borate mineral that typically takes the form of a red gemstone. Highly sought after because of its beauty and scarcity. — In-Game Description"
    },
    "Platinum": {
        "name": "Platinum",
        "type": "Metal",
        "rarity": "Rare",
        "commodityCategory": "Metals",
        "description": "Platinum, Pt. A grey-white precious metal used as a catalyst within many industrial processes, in addition to its value in electronics and luxury goods. — In-Game Description"
    },
    "Rhodplumsite": {
        "name": "Rhodplumsite",
        "type": "Mineral",
        "rarity": "Rare",
        "commodityCategory": "Minerals",
        "description": "Rhodplumsite is a rhodium-lead sulphide mineral that exhibits different colours when viewed from different angles. — In-Game Description"
    },
    "Serendibite": {
        "name": "Serendibite",
        "type": "Gemstone",
        "rarity": "Very Rare",
        "commodityCategory": "Minerals",
        "description": "Serendibite is a pale yellow, blue-green or greyish blue silicate mineral named after Serendib, the old Arabic name for Sri Lanka. — In-Game Description"
    },
    "Tritium": {
        "name": "Tritium",
        "type": "Fuel",
        "rarity": "Uncommon",
        "commodityCategory": "Chemicals",
        "description": "Tritium is a beta-emitting radioactive isotope of hydrogen, used to boost nuclear fusion reactions. — In-Game Description"
    }
};
