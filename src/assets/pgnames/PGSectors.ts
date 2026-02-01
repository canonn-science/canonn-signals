interface FragmentInfo {
    value: string;
    isPrefix: boolean;
    isC1VowelPrefix: boolean;
    isC2VowelPrefix: boolean;
    prefixIndex: number;
    isInfix: boolean;
    isVowelInfix: boolean;
    infixIndex: number;
    isSuffix: boolean;
    isVowelSuffix: boolean;
    suffixIndex: number;
}

export class ByteXYZ {
    x: number;
    y: number;
    z: number;

    constructor(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    get ord(): number {
        return this.x + this.y * 128 + this.z * 16384;
    }

    toString(): string {
        return `(${this.x},${this.y},${this.z})`;
    }

    equals(other: ByteXYZ): boolean {
        return other != null && this.ord === other.ord;
    }

    compareTo(other: ByteXYZ): number {
        return this.ord - other.ord;
    }

    getHashCode(): number {
        return this.ord;
    }

    static readonly Invalid = new this(-128, -128, -128);
}

export class PGSectors {
    private static readonly Prefixes = [
        'Th', 'Eo', 'Oo', 'Eu', 'Tr', 'Sly', 'Dry', 'Ou',
        'Tz', 'Phl', 'Ae', 'Sch', 'Hyp', 'Syst', 'Ai', 'Kyl',
        'Phr', 'Eae', 'Ph', 'Fl', 'Ao', 'Scr', 'Shr', 'Fly',
        'Pl', 'Fr', 'Au', 'Pry', 'Pr', 'Hyph', 'Py', 'Chr',
        'Phyl', 'Tyr', 'Bl', 'Cry', 'Gl', 'Br', 'Gr', 'By',
        'Aae', 'Myc', 'Gyr', 'Ly', 'Myl', 'Lych', 'Myn', 'Ch',
        'Myr', 'Cl', 'Rh', 'Wh', 'Pyr', 'Cr', 'Syn', 'Str',
        'Syr', 'Cy', 'Wr', 'Hy', 'My', 'Sty', 'Sc', 'Sph',
        'Spl', 'A', 'Sh', 'B', 'C', 'D', 'Sk', 'Io',
        'Dr', 'E', 'Sl', 'F', 'Sm', 'G', 'H', 'I',
        'Sp', 'J', 'Sq', 'K', 'L', 'Pyth', 'M', 'St',
        'N', 'O', 'Ny', 'Lyr', 'P', 'Sw', 'Thr', 'Lys',
        'Q', 'R', 'S', 'T', 'Ea', 'U', 'V', 'W',
        'Schr', 'X', 'Ee', 'Y', 'Z', 'Ei', 'Oe',
    ];

    private static readonly Infixes1 = [
        'o', 'ai', 'a', 'oi', 'ea', 'ie', 'u', 'e',
        'ee', 'oo', 'ue', 'i', 'oa', 'au', 'ae', 'oe'
    ];

    private static readonly Infixes2 = [
        'll', 'ss', 'b', 'c', 'd', 'f', 'dg', 'g',
        'ng', 'h', 'j', 'k', 'l', 'm', 'n', 'mb',
        'p', 'q', 'gn', 'th', 'r', 's', 't', 'ch',
        'tch', 'v', 'w', 'wh', 'ck', 'x', 'y', 'z',
        'ph', 'sh', 'ct', 'wr'
    ];

    private static readonly Suffixes1 = [
        'oe', 'io', 'oea', 'oi', 'aa', 'ua', 'eia', 'ae',
        'ooe', 'oo', 'a', 'ue', 'ai', 'e', 'iae', 'oae',
        'ou', 'uae', 'i', 'ao', 'au', 'o', 'eae', 'u',
        'aea', 'ia', 'ie', 'eou', 'aei', 'ea', 'uia', 'oa',
        'aae', 'eau', 'ee'
    ];

    private static readonly Suffixes2 = [
        'b', 'scs', 'wsy', 'c', 'd', 'vsky', 'f', 'sms',
        'dst', 'g', 'rb', 'h', 'nts', 'ch', 'rd', 'rld',
        'k', 'lls', 'ck', 'rgh', 'l', 'rg', 'm', 'n',
        'hm', 'p', 'hn', 'rk', 'q', 'rl', 'r', 'rm',
        's', 'cs', 'wyg', 'rn', 'ct', 't', 'hs', 'rbs',
        'rp', 'tts', 'v', 'wn', 'ms', 'w', 'rr', 'mt',
        'x', 'rs', 'cy', 'y', 'rt', 'z', 'ws', 'lch',
        'my', 'ry', 'nks', 'nd', 'sc', 'ng', 'sh', 'nk',
        'sk', 'nn', 'ds', 'sm', 'sp', 'ns', 'nt', 'dy',
        'ss', 'st', 'rrs', 'xt', 'nz', 'sy', 'xy', 'rsch',
        'rphs', 'sts', 'sys', 'sty', 'th', 'tl', 'tls', 'rds',
        'nch', 'rns', 'ts', 'wls', 'rnt', 'tt', 'rdy', 'rst',
        'pps', 'tz', 'tch', 'sks', 'ppy', 'ff', 'sps', 'kh',
        'sky', 'ph', 'lts', 'wnst', 'rth', 'ths', 'fs', 'pp',
        'ft', 'ks', 'pr', 'ps', 'pt', 'fy', 'rts', 'ky',
        'rshch', 'mly', 'py', 'bb', 'nds', 'wry', 'zz', 'nns',
        'ld', 'lf', 'gh', 'lks', 'sly', 'lk', 'll', 'rph',
        'ln', 'bs', 'rsts', 'gs', 'ls', 'vvy', 'lt', 'rks',
        'qs', 'rps', 'gy', 'wns', 'lz', 'nth', 'phs'
    ];

    private static readonly C2PrefixSuffix2 = new Set(
        ['Eo', 'Oo', 'Eu', 'Ou', 'Ae', 'Ai', 'Eae', 'Ao', 'Au', 'Aae']
            .map(s => s.toLowerCase())
    );

    private static readonly C1PrefixInfix2 = new Set(
        [
            'Eo', 'Oo', 'Eu', 'Ou', 'Ae', 'Ai', 'Eae', 'Ao',
            'Au', 'Aae', 'A', 'Io', 'E', 'I', 'O', 'Ea',
            'U', 'Ee', 'Ei', 'Oe'
        ].map(s => s.toLowerCase())
    );

    private static readonly PrefixRunLengths: Map<string, number> = new Map([
        ['eu', 31], ['sly', 4], ['tz', 1], ['phl', 13],
        ['ae', 12], ['hyp', 25], ['kyl', 30], ['phr', 10],
        ['eae', 4], ['ao', 5], ['scr', 24], ['shr', 11],
        ['fly', 20], ['pry', 3], ['hyph', 14], ['py', 12],
        ['phyl', 8], ['tyr', 25], ['cry', 5], ['aae', 5],
        ['myc', 2], ['gyr', 10], ['myl', 12], ['lych', 3],
        ['myn', 10], ['myr', 4], ['rh', 15], ['wr', 31],
        ['sty', 4], ['spl', 16], ['sk', 27], ['sq', 7],
        ['pyth', 1], ['lyr', 10], ['sw', 24], ['thr', 32],
        ['lys', 10], ['schr', 3], ['z', 34],
    ]);

    private static readonly InfixRunLengths: Map<string, number> = new Map([
        ['oi', 88], ['ue', 147], ['oa', 57],
        ['au', 119], ['ae', 12], ['oe', 39],
        ['dg', 31], ['tch', 20], ['wr', 31],
    ]);

    private static cachedSectorsByCoords: Map<string, string> = new Map();
    private static cachedSectorsByName: Map<string, ByteXYZ> = new Map();

    private static fragments: FragmentInfo[] = [];
    private static prefixOffsets: Map<string, number> = new Map();
    private static prefixTotalRunLength: number = 0;
    private static infixOffsets: Map<string, number> = new Map();
    private static infix1TotalRunLength: number = 0;
    private static infix2TotalRunLength: number = 0;

    private static initialize(): void {
        if (PGSectors.fragments.length > 0) return;

        PGSectors.prefixTotalRunLength = PGSectors.fillOffsets(
            PGSectors.Prefixes,
            PGSectors.PrefixRunLengths,
            PGSectors.prefixOffsets,
            35
        );

        PGSectors.infix1TotalRunLength = PGSectors.fillOffsets(
            PGSectors.Infixes1,
            PGSectors.InfixRunLengths,
            PGSectors.infixOffsets,
            PGSectors.Suffixes2.length
        );

        PGSectors.infix2TotalRunLength = PGSectors.fillOffsets(
            PGSectors.Infixes2,
            PGSectors.InfixRunLengths,
            PGSectors.infixOffsets,
            PGSectors.Suffixes1.length
        );

        PGSectors.fragments = PGSectors.fillFragments(
            PGSectors.Prefixes,
            PGSectors.Infixes1,
            PGSectors.Infixes2,
            PGSectors.Suffixes1,
            PGSectors.Suffixes2
        );
    }

    private static fillOffsets(
        items: string[],
        runlengths: Map<string, number>,
        offsets: Map<string, number>,
        defaultlen: number
    ): number {
        let cnt = 0;
        for (const item of items) {
            const itemLower = item.toLowerCase();
            let plen = runlengths.get(itemLower) || defaultlen;
            if (!runlengths.has(itemLower)) {
                runlengths.set(itemLower, plen);
            }
            offsets.set(itemLower, cnt);
            cnt += plen;
        }
        return cnt;
    }

    private static fillFragments(
        prefixes: string[],
        infixes1: string[],
        infixes2: string[],
        suffixes1: string[],
        suffixes2: string[]
    ): FragmentInfo[] {
        const frags: Map<string, FragmentInfo> = new Map();

        for (let i = 0; i < prefixes.length; i++) {
            const prefix = prefixes[i];
            const p = prefix.toLowerCase();
            let frag = frags.get(p) || {
                value: p,
                isPrefix: false,
                isC1VowelPrefix: false,
                isC2VowelPrefix: false,
                prefixIndex: 0,
                isInfix: false,
                isVowelInfix: false,
                infixIndex: 0,
                isSuffix: false,
                isVowelSuffix: false,
                suffixIndex: 0,
            };
            frag.isPrefix = true;
            frag.isC1VowelPrefix = PGSectors.C1PrefixInfix2.has(p);
            frag.isC2VowelPrefix = PGSectors.C2PrefixSuffix2.has(p);
            frag.prefixIndex = i;
            frags.set(p, frag);
        }

        for (let i = 0; i < infixes1.length; i++) {
            const p = infixes1[i].toLowerCase();
            let frag = frags.get(p) || {
                value: p,
                isPrefix: false,
                isC1VowelPrefix: false,
                isC2VowelPrefix: false,
                prefixIndex: 0,
                isInfix: false,
                isVowelInfix: false,
                infixIndex: 0,
                isSuffix: false,
                isVowelSuffix: false,
                suffixIndex: 0,
            };
            frag.isInfix = true;
            frag.isVowelInfix = true;
            frag.infixIndex = i;
            frags.set(p, frag);
        }

        for (let i = 0; i < infixes2.length; i++) {
            const p = infixes2[i].toLowerCase();
            let frag = frags.get(p) || {
                value: p,
                isPrefix: false,
                isC1VowelPrefix: false,
                isC2VowelPrefix: false,
                prefixIndex: 0,
                isInfix: false,
                isVowelInfix: false,
                infixIndex: 0,
                isSuffix: false,
                isVowelSuffix: false,
                suffixIndex: 0,
            };
            frag.isInfix = true;
            frag.isVowelInfix = false;
            frag.infixIndex = i;
            frags.set(p, frag);
        }

        for (let i = 0; i < suffixes1.length; i++) {
            const p = suffixes1[i].toLowerCase();
            let frag = frags.get(p) || {
                value: p,
                isPrefix: false,
                isC1VowelPrefix: false,
                isC2VowelPrefix: false,
                prefixIndex: 0,
                isInfix: false,
                isVowelInfix: false,
                infixIndex: 0,
                isSuffix: false,
                isVowelSuffix: false,
                suffixIndex: 0,
            };
            frag.isSuffix = true;
            frag.isVowelSuffix = true;
            frag.suffixIndex = i;
            frags.set(p, frag);
        }

        for (let i = 0; i < suffixes2.length; i++) {
            const p = suffixes2[i].toLowerCase();
            let frag = frags.get(p) || {
                value: p,
                isPrefix: false,
                isC1VowelPrefix: false,
                isC2VowelPrefix: false,
                prefixIndex: 0,
                isInfix: false,
                isVowelInfix: false,
                infixIndex: 0,
                isSuffix: false,
                isVowelSuffix: false,
                suffixIndex: 0,
            };
            frag.isSuffix = true;
            frag.isVowelSuffix = false;
            frag.suffixIndex = i;
            frags.set(p, frag);
        }

        return Array.from(frags.values())
            .sort((a, b) => b.value.length - a.value.length || a.value.localeCompare(b.value));
    }

    static getSectorName(pos: ByteXYZ): string {
        PGSectors.initialize();
        const key = pos.toString();
        if (PGSectors.cachedSectorsByCoords.has(key)) {
            return PGSectors.cachedSectorsByCoords.get(key)!;
        }

        const offset = (pos.z << 14) + (pos.y << 7) + pos.x;
        console.log(`[getSectorName] Coords: (${pos.x}, ${pos.y}, ${pos.z}), Offset: ${offset}`);
        
        let sectorname: string;

        if (PGSectors.isC1Sector(offset)) {
            console.log(`[getSectorName] Using C1 naming for offset ${offset}`);
            sectorname = PGSectors.getC1Name(offset) || '';
        } else {
            console.log(`[getSectorName] Using C2 naming for offset ${offset}`);
            sectorname = PGSectors.getC2Name(offset);
        }

        console.log(`[getSectorName] Final sector name: "${sectorname}"`);
        PGSectors.cachedSectorsByCoords.set(key, sectorname);
        return sectorname;
    }

    static getC1SectorName(pos: ByteXYZ): string {
        PGSectors.initialize();
        return PGSectors.getC1Name((pos.z << 14) + (pos.y << 7) + pos.x) || '';
    }

    static getC2SectorName(pos: ByteXYZ): string {
        PGSectors.initialize();
        return PGSectors.getC2Name((pos.z << 14) + (pos.y << 7) + pos.x);
    }

    private static isC1Sector(offset: number): boolean {
        let key = offset >>> 0; // Convert to unsigned 32-bit

        // 32-bit hashing algorithm
        key = (key + (key << 12)) >>> 0;
        key ^= key >>> 22;
        key = (key + (key << 4)) >>> 0;
        key ^= key >>> 9;
        key = (key + (key << 10)) >>> 0;
        key ^= key >>> 2;
        key = (key + (key << 7)) >>> 0;
        key ^= key >>> 12;

        return (key & 1) === 0;
    }

    private static getC1Name(offset: number): string | null {
        const frags: string[] = [];
        const prefixCnt = Math.floor(offset / PGSectors.prefixTotalRunLength);
        let curOffset = offset % PGSectors.prefixTotalRunLength;

        let prefix = '';
        let prefixLower = '';
        for (const p of PGSectors.Prefixes) {
            const pLower = p.toLowerCase();
            if ((PGSectors.prefixOffsets.get(pLower) || 0) <= curOffset) {
                prefix = p;
                prefixLower = pLower;
            }
        }

        frags.push(prefix);
        curOffset -= PGSectors.prefixOffsets.get(prefixLower) || 0;

        const infix1s2 = PGSectors.C1PrefixInfix2.has(prefixLower);
        const infix1TotalLen = infix1s2 ? PGSectors.infix2TotalRunLength : PGSectors.infix1TotalRunLength;
        const infix1s = infix1s2 ? PGSectors.Infixes2 : PGSectors.Infixes1;

        const infix1Cnt = Math.floor((prefixCnt * (PGSectors.PrefixRunLengths.get(prefixLower) || 35) + curOffset) / infix1TotalLen);
        curOffset = ((prefixCnt * (PGSectors.PrefixRunLengths.get(prefixLower) || 35) + curOffset) % infix1TotalLen);

        let infix1 = '';
        for (const p of infix1s) {
            const pLower = p.toLowerCase();
            if ((PGSectors.infixOffsets.get(pLower) || 0) <= curOffset) {
                infix1 = pLower;
            }
        }

        frags.push(infix1);
        curOffset -= PGSectors.infixOffsets.get(infix1) || 0;

        const infix1RunLen = PGSectors.InfixRunLengths.get(infix1) || 35;
        let suffixes = infix1s2 ? PGSectors.Suffixes1 : PGSectors.Suffixes2;
        let nextIdx = infix1RunLen * infix1Cnt + curOffset;

        if (nextIdx >= suffixes.length) {
            const infix2s2 = !infix1s2;
            const infix2TotalLen = infix2s2 ? PGSectors.infix2TotalRunLength : PGSectors.infix1TotalRunLength;
            const infix2Cnt = Math.floor(nextIdx / infix2TotalLen);
            curOffset = nextIdx % infix2TotalLen;

            const infix2s = infix2s2 ? PGSectors.Infixes2 : PGSectors.Infixes1;
            let infix2 = '';
            for (const p of infix2s) {
                const pLower = p.toLowerCase();
                if ((PGSectors.infixOffsets.get(pLower) || 0) <= curOffset) {
                    infix2 = pLower;
                }
            }

            frags.push(infix2);
            curOffset -= PGSectors.infixOffsets.get(infix2) || 0;

            const infix2RunLen = PGSectors.InfixRunLengths.get(infix2) || 35;
            suffixes = infix2s2 ? PGSectors.Suffixes1 : PGSectors.Suffixes2;
            nextIdx = infix2RunLen * infix2Cnt + curOffset;
        }

        if (nextIdx >= suffixes.length) {
            return null;
        }

        frags.push(suffixes[nextIdx].toLowerCase());
        return frags.join('');
    }

    private static getC2Name(offset: number): string {
        const [idx0, idx1] = PGSectors.deinterleave2(offset);
        console.log(`[getC2Name] Offset: ${offset}, Deinterleaved: idx0=${idx0}, idx1=${idx1}`);

        let p1 = '';
        let p1Lower = '';
        console.log(`[getC2Name] Finding prefix 1 for idx0=${idx0}:`);
        for (const p of PGSectors.Prefixes) {
            const pLower = p.toLowerCase();
            const offset = PGSectors.prefixOffsets.get(pLower) || 0;
            if (offset <= idx0) {
                console.log(`  - "${p}" (offset=${offset}) matches`);
                p1 = p;
                p1Lower = pLower;
            }
        }
        console.log(`[getC2Name] Selected p1="${p1}" (lower="${p1Lower}")`);

        let p2 = '';
        let p2Lower = '';
        console.log(`[getC2Name] Finding prefix 2 for idx1=${idx1}:`);
        for (const p of PGSectors.Prefixes) {
            const pLower = p.toLowerCase();
            const offset = PGSectors.prefixOffsets.get(pLower) || 0;
            if (offset <= idx1) {
                console.log(`  - "${p}" (offset=${offset}) matches`);
                p2 = p;
                p2Lower = pLower;
            }
        }
        console.log(`[getC2Name] Selected p2="${p2}" (lower="${p2Lower}")`);

        const s1s = PGSectors.C2PrefixSuffix2.has(p1Lower) ? PGSectors.Suffixes2 : PGSectors.Suffixes1;
        const s2s = PGSectors.C2PrefixSuffix2.has(p2Lower) ? PGSectors.Suffixes2 : PGSectors.Suffixes1;
        
        const p1Offset = PGSectors.prefixOffsets.get(p1Lower) || 0;
        const p2Offset = PGSectors.prefixOffsets.get(p2Lower) || 0;
        const s1Index = idx0 - p1Offset;
        const s2Index = idx1 - p2Offset;
        
        console.log(`[getC2Name] Suffix arrays: s1s=${s1s === PGSectors.Suffixes2 ? 'Suffixes2' : 'Suffixes1'}, s2s=${s2s === PGSectors.Suffixes2 ? 'Suffixes2' : 'Suffixes1'}`);
        console.log(`[getC2Name] Suffix indices: s1Index=${s1Index}, s2Index=${s2Index}`);

        const s1 = s1s[s1Index];
        const s2 = s2s[s2Index];
        
        console.log(`[getC2Name] Suffixes: s1="${s1}", s2="${s2}"`);

        const result = `${p1}${s1.toLowerCase()} ${p2}${s2.toLowerCase()}`;
        console.log(`[getC2Name] Final result: "${result}"`);
        return result;
    }

    private static getSectorFragments(name: string): FragmentInfo[] | null {
        PGSectors.initialize();
        name = name.toLowerCase();
        const fragments: FragmentInfo[] = [];
        let current = name;

        while (current.length > 0) {
            const spacestart = current.startsWith(' ');
            current = current.trim();

            const frag = PGSectors.fragments.find(f => current.startsWith(f.value));
            if (!frag) {
                return null;
            }

            if (spacestart) {
                frag.isSuffix = false;
                frag.isInfix = false;
            } else if (fragments.length > 0 && frag.isInfix && frag.isVowelInfix !== fragments[fragments.length - 1].isVowelInfix) {
                frag.isPrefix = false;
            }

            fragments.push({ ...frag });
            current = current.substring(frag.value.length);
        }

        return fragments;
    }

    static getSectorPos(name: string): ByteXYZ {
        const key = name.toLowerCase();
        if (PGSectors.cachedSectorsByName.has(key)) {
            return PGSectors.cachedSectorsByName.get(key)!;
        }

        let coords: ByteXYZ;
        const fragments = PGSectors.getSectorFragments(name);

        if (!fragments) {
            coords = ByteXYZ.Invalid;
        } else if (
            fragments.length === 4 &&
            fragments[0].isPrefix &&
            fragments[1].isSuffix &&
            fragments[2].isPrefix &&
            fragments[3].isSuffix
        ) {
            coords = PGSectors.getC2SectorPos(fragments);
        } else if (
            fragments.length === 3 &&
            fragments[0].isPrefix &&
            fragments[1].isInfix &&
            fragments[2].isSuffix
        ) {
            coords = PGSectors.getC1SectorPos3(fragments);
        } else if (
            fragments.length === 4 &&
            fragments[0].isPrefix &&
            fragments[1].isInfix &&
            fragments[2].isInfix &&
            fragments[3].isSuffix
        ) {
            coords = PGSectors.getC1SectorPos4(fragments);
        } else {
            coords = ByteXYZ.Invalid;
        }

        PGSectors.cachedSectorsByName.set(key, coords);
        return coords;
    }

    private static getC2SectorPos(fragments: FragmentInfo[]): ByteXYZ {
        if (
            fragments[0].isC2VowelPrefix === fragments[1].isVowelSuffix ||
            fragments[2].isC2VowelPrefix === fragments[3].isVowelSuffix
        ) {
            return ByteXYZ.Invalid;
        }

        const idx0 = (PGSectors.prefixOffsets.get(fragments[0].value) || 0) + fragments[1].suffixIndex;
        const idx1 = (PGSectors.prefixOffsets.get(fragments[2].value) || 0) + fragments[3].suffixIndex;
        const offset = PGSectors.interleave2(idx0, idx1);

        return new ByteXYZ(
            (offset & 0x7f) as any,
            ((offset >> 7) & 0x7f) as any,
            ((offset >> 14) & 0x7f) as any
        );
    }

    private static c1ProcessInfixFragment(frag: FragmentInfo, offset: number): number {
        const rem = offset % (PGSectors.InfixRunLengths.get(frag.value) || 35);
        offset = Math.floor(offset / (PGSectors.InfixRunLengths.get(frag.value) || 35));
        offset *= frag.isVowelInfix ? PGSectors.infix1TotalRunLength : PGSectors.infix2TotalRunLength;
        offset += rem;
        offset += PGSectors.infixOffsets.get(frag.value) || 0;
        return offset;
    }

    private static c1ProcessPrefixFragment(frag: FragmentInfo, offset: number): number {
        const rem = offset % (PGSectors.PrefixRunLengths.get(frag.value) || 35);
        offset = Math.floor(offset / (PGSectors.PrefixRunLengths.get(frag.value) || 35));
        offset *= PGSectors.prefixTotalRunLength;
        offset += rem;
        offset += PGSectors.prefixOffsets.get(frag.value) || 0;
        return offset;
    }

    private static getC1SectorPos4(fragments: FragmentInfo[]): ByteXYZ {
        if (
            fragments[0].isC1VowelPrefix === fragments[1].isVowelInfix ||
            fragments[1].isVowelInfix === fragments[2].isVowelInfix ||
            fragments[2].isVowelInfix === fragments[3].isVowelSuffix
        ) {
            return ByteXYZ.Invalid;
        }

        let offset = fragments[3].suffixIndex;
        offset += Math.floor(offset / (PGSectors.InfixRunLengths.get(fragments[2].value) || 35)) *
            (fragments[2].isVowelInfix ? PGSectors.infix1TotalRunLength : PGSectors.infix2TotalRunLength);

        offset = PGSectors.c1ProcessInfixFragment(fragments[2], offset);
        offset = PGSectors.c1ProcessInfixFragment(fragments[1], offset);
        offset = PGSectors.c1ProcessPrefixFragment(fragments[0], offset);

        return new ByteXYZ(
            (offset & 0x7f) as any,
            ((offset >> 7) & 0x7f) as any,
            ((offset >> 14) & 0x7f) as any
        );
    }

    private static getC1SectorPos3(fragments: FragmentInfo[]): ByteXYZ {
        if (
            fragments[0].isC1VowelPrefix === fragments[1].isVowelInfix ||
            fragments[1].isVowelInfix === fragments[2].isVowelSuffix
        ) {
            return ByteXYZ.Invalid;
        }

        let offset = fragments[2].suffixIndex;
        offset = PGSectors.c1ProcessInfixFragment(fragments[1], offset);
        offset = PGSectors.c1ProcessPrefixFragment(fragments[0], offset);

        return new ByteXYZ(
            (offset & 0x7f) as any,
            ((offset >> 7) & 0x7f) as any,
            ((offset >> 14) & 0x7f) as any
        );
    }

    private static interleave2(v1: number, v2: number): number {
        let x = BigInt(v1) | (BigInt(v2) << 32n);
        x = (x | (x << 8n)) & 0x00ff00ff00ff00ffn;
        x = (x | (x << 4n)) & 0x0f0f0f0f0f0f0f0fn;
        x = (x | (x << 2n)) & 0x3333333333333333n;
        x = (x | (x << 1n)) & 0x5555555555555555n;
        return Number((x | (x >> 31n)) & 0xffffffffn);
    }

    private static deinterleave2(val: number): [number, number] {
        const valBig = BigInt(val);
        let x = (valBig & 0x55555555n) | ((valBig & 0xaaaaaaaaan) << 31n);
        x = (x | (x >> 1n)) & 0x3333333333333333n;
        x = (x | (x >> 2n)) & 0x0f0f0f0f0f0f0f0fn;
        x = (x | (x >> 4n)) & 0x00ff00ff00ff00ffn;
        x = (x | (x >> 8n)) & 0x0000ffff0000ffffn;
        return [Number(x & 0xffffn), Number((x >> 32n) & 0xffffn)];
    }

    private static interleave3(val: ByteXYZ): number {
        let x = BigInt((val.x & 0x7f)) | (BigInt(val.y & 0x7f) << 7n) | (BigInt(val.z & 0x7f) << 14n);
        x = (x | (x << 32n)) & 0x001f00000000ffffn;
        x = (x | (x << 16n)) & 0x001f0000ff0000ffn;
        x = (x | (x << 8n)) & 0x100f00f00f00f00fn;
        x = (x | (x << 4n)) & 0x10c30c30c30c30c3n;
        x = (x | (x << 2n)) & 0x1249249249249249n;
        return Number((x | (x >> 20n) | (x >> 40n)) & 0x1fffffn);
    }

    private static deinterleave3(val: number): ByteXYZ {
        const valBig = BigInt(val);
        let x = (valBig & 0x49249n) | ((valBig & 0x92492n) << 20n) | ((valBig & 0x124924n) << 40n);
        x = (x | (x >> 2n)) & 0x10c30c30c30c30c3n;
        x = (x | (x >> 4n)) & 0x100f00f00f00f00fn;
        x = (x | (x >> 8n)) & 0x001f0000ff0000ffn;
        x = (x | (x >> 16n)) & 0x001f00000000ffffn;
        x = (x | (x >> 32n)) & 0x00000000001fffffn;
        return new ByteXYZ(
            Number(x & 0x7fn) as any,
            Number((x >> 7n) & 0x7fn) as any,
            Number((x >> 14n) & 0x7fn) as any
        );
    }
}
