import { PGRegion } from './PGRegion';
import { PGSectors } from './PGSectors';
import { ByteXYZ } from './PGSectors';

export interface IPGSystem {
    regionName: string;
    sequence: number;
    mid1a: number;
    mid1b: number;
    mid2: number;
    sizeClass: number;
    mid3: number;
}

export class PGSystem implements IPGSystem {
    regionName: string = '';
    sequence: number = 0;
    mid1a: number = 0;
    mid1b: number = 0;
    mid2: number = 0;
    sizeClass: number = 0;
    mid3: number = 0;

    get region(): PGRegion {
        return PGRegion.getRegion(this.regionName);
    }

    private static toLetter(value: number): string {
        return String.fromCharCode('a'.charCodeAt(0) + value);
    }

    toPGName(): string {
        const mid1a = PGSystem.toLetter(this.mid1a);
        const mid1b = PGSystem.toLetter(this.mid1b);
        const mid2 = PGSystem.toLetter(this.mid2);
        const size = PGSystem.toLetter(this.sizeClass);
        const mid3 = Math.trunc(this.mid3);
        const seq = Math.trunc(this.sequence);

        // Elite Dangerous omits the N1 field (and its hyphen) when it is zero,
        // so "Synuefe WH-F c0" (N1=0, N2=0) must not render as "…c0-0".
        const index = mid3 !== 0 ? `${mid3}-${seq}` : `${seq}`;
        return `${this.regionName} ${mid1a}${mid1b}-${mid2} ${size}${index}`;
    }

    /**
     * Get the correctly-cased name for a given sector or system name
     * @param name A system or sector name, in any case
     * @param sectorOnly If true, only process sector name
     * @returns The input system/sector name with its case corrected
     */
    static getCanonicalName(name: string, sectorOnly: boolean = false): string | null {
        const result = PGSystem.getCanonicalNameFragments(name, sectorOnly);
        if (result === null || result['SectorName'] === undefined) {
            return null;
        }
        if (!sectorOnly && Object.keys(result).length > 1) {
            return PGSystem.formatSystemName(result);
        }
        return result['SectorName'];
    }

    /**
     * Get canonical name fragments of a system/sector
     * @param name A system or sector name, in any case
     * @param sectorOnly If true, only process sector name
     * @returns Object with SectorName, L1, L2, L3, MCode, N1, N2
     */
    static getCanonicalNameFragments(name: string, sectorOnly: boolean = false): any {
        let sectname: string | null = null;

        // Try to parse as full system name
        const systemMatch = PGSystem.tryParse(name);
        if (systemMatch[0]) {
            const sys = systemMatch[1];
            sectname = sys.regionName;
        } else if (sectorOnly) {
            // If sector_only and not a system name, treat whole input as sector name
            sectname = name;
        } else {
            return { 'SectorName': null };
        }

        // If we have a sector name, try to canonicalize it
        let canonicalSectorName: string | null = null;
        if (sectname) {
            // Get sector fragments and reformat to get canonical case
            const frags = PGSystem.getSectorFragments(sectname);
            if (frags !== null) {
                canonicalSectorName = PGSystem.formatSectorName(frags);
            }
        }

        // Build result based on what we're returning
        if (!sectorOnly && systemMatch[0]) {
            const sys = systemMatch[1];
            return {
                'SectorName': canonicalSectorName,
                'L1': PGSystem.toLetter(sys.mid1a).toUpperCase(),
                'L2': PGSystem.toLetter(sys.mid1b).toUpperCase(),
                'L3': PGSystem.toLetter(sys.mid2).toUpperCase(),
                'MCode': PGSystem.toLetter(sys.sizeClass).toLowerCase(),
                'N1': sys.mid3,
                'N2': sys.sequence
            };
        } else {
            return { 'SectorName': canonicalSectorName };
        }
    }

    /**
     * Format system name from components
     * @param input Object with SectorName, L1, L2, L3, MCode, N1, N2
     * @returns Formatted system name like "Sector AB-C d1-23"
     */
    static formatSystemName(input: any): string | null {
        if (input === null || !input['SectorName']) {
            return null;
        }

        const sectorName = input['SectorName'] || '';
        const l1 = (input['L1'] || '').toUpperCase();
        const l2 = (input['L2'] || '').toUpperCase();
        const l3 = (input['L3'] || '').toUpperCase();
        const mcode = (input['MCode'] || '').toLowerCase();
        const n1 = input['N1'] || 0;
        const n2 = input['N2'] || 0;

        if (n1 !== 0 && n1 !== null) {
            return `${sectorName} ${l1}${l2}-${l3} ${mcode}${n1}-${n2}`;
        } else {
            return `${sectorName} ${l1}${l2}-${l3} ${mcode}${n2}`;
        }
    }

    /**
     * Format sector name from fragments
     * @param input List of sector name fragments or a string
     * @returns Formatted sector name
     */
    static formatSectorName(input: string[] | string): string | null {
        const frags = typeof input === 'string'
            ? PGSystem.getSectorFragments(input)
            : input;

        if (frags === null) {
            return null;
        }

        if (frags.length === 4 && frags[2].charCodeAt(0) >= 65 && frags[2].charCodeAt(0) <= 90) {
            // Class 2 with prefix: format as "Frag1Frag2 Frag3Frag4"
            return `${frags[0]}${frags[1]} ${frags[2]}${frags[3]}`;
        } else {
            // Class 1: join all fragments
            return frags.join('');
        }
    }

    /**
     * Get sector fragments from a sector name string
     * @param sectorName The sector name
     * @returns Array of fragments or null if invalid
     */
    static getSectorFragments(sectorName: string): string[] | null {
        // Convert to title case and remove spaces
        sectorName = sectorName
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');

        // Known prefixes and infixes (subset for basic parsing)
        // For full implementation, this would need the complete PGData
        const validPrefixes = [
            'Th', 'P', 'Q', 'Fr', 'Gr', 'Bl', 'Br', 'Cr', 'Dr', 'Fl', 'Gl', 'Pr', 'Sk', 'Sm', 'Sp', 'St', 'Str', 'Sw', 'Tr', 'Tw', 'Tz',
            'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
        ];

        const segments: string[] = [];
        let current = sectorName;
        let maxIterations = 4; // Maximum fragment count

        while (current.length > 0 && maxIterations > 0) {
            let found = false;
            // Try to match fragments starting with longest prefixes first
            for (let prefixLen = Math.min(3, current.length); prefixLen > 0; prefixLen--) {
                const frag = current.substring(0, prefixLen);
                if (validPrefixes.includes(frag)) {
                    segments.push(frag);
                    current = current.substring(prefixLen);
                    found = true;
                    maxIterations--;
                    break;
                }
            }
            if (!found) {
                break;
            }
        }

        return current.length === 0 ? segments : null;
    }

    /**
     * Check whether the given name is a valid PG system name
     * @param name A system name
     * @param strict If true, will also check the sector name is a valid sector
     * @returns True if the name is valid, False if not
     */
    static isPGSystemName(name: string, strict: boolean = false): boolean {
        if (!name) {
            return false;
        }

        // Try to parse the system name
        const [success, sys] = PGSystem.tryParse(name.trim());
        if (!success) {
            return false;
        }

        // If strict mode, validate the sector name
        if (strict) {
            // Check if the sector name can be parsed into valid fragments
            const frags = PGSystem.getSectorFragments(sys.regionName);
            return frags !== null && frags.length > 0;
        }

        return true;
    }

    static tryParse(s: string): [boolean, PGSystem] {
        const sys = new PGSystem();
        if (s == null) return [false, sys];

        let i = s.length - 1;
        const _s = s.toLowerCase();

        if (i < 9) return [false, sys]; // a bc-d e0
        if (_s[i] < '0' || _s[i] > '9') return [false, sys]; // cepheus dark region a sector xy-z a1-[0]

        while (i > 8 && _s[i] >= '0' && _s[i] <= '9') i--;

        const seqStr = _s.substring(i + 1);
        const seq = parseInt(seqStr);
        if (isNaN(seq)) return [false, sys];
        sys.sequence = seq;

        if (_s[i] === '-') {
            // cepheus dark region a sector xy-z a1[-]0
            i--;
            const vend = i;
            while (i > 8 && _s[i] >= '0' && _s[i] <= '9') i--;
            if (i === vend) return [false, sys];

            const mid3Str = _s.substring(i + 1, vend + 1);
            const mid3 = parseInt(mid3Str);
            if (isNaN(mid3)) return [false, sys];
            sys.mid3 = mid3;
        }

        if (_s[i] < 'a' || _s[i] > 'h') return [false, sys]; // cepheus dark region a sector xy-z [a]1-0
        sys.sizeClass = _s.charCodeAt(i) - 'a'.charCodeAt(0);
        i--;

        if (_s[i] !== ' ') return [false, sys]; // cepheus dark region a sector xy-z[ ]a1-0
        i--;

        if (_s[i] < 'a' || _s[i] > 'z') return [false, sys]; // cepheus dark region a sector xy-[z] a1-0
        sys.mid2 = _s.charCodeAt(i) - 'a'.charCodeAt(0);
        i--;

        if (_s[i] !== '-') return [false, sys]; // cepheus dark region a sector xy[-]z a1-0
        i--;

        if (_s[i] < 'a' || _s[i] > 'z') return [false, sys]; // cepheus dark region a sector x[y]-z a1-0
        sys.mid1b = _s.charCodeAt(i) - 'a'.charCodeAt(0);
        i--;

        if (_s[i] < 'a' || _s[i] > 'z') return [false, sys]; // cepheus dark region a sector [x]y-z a1-0
        sys.mid1a = _s.charCodeAt(i) - 'a'.charCodeAt(0);
        i--;

        if (_s[i] !== ' ') return [false, sys]; // cepheus dark region a sector[ ]xy-z a1-0
        i--;

        const regname = s.substring(0, i + 1); // [cepheus dark region a sector] xy-z a1-0
        sys.regionName = regname;
        return [true, sys];
    }

    /**
     * Absolute boxel coordinates (from the galaxy origin) of this system's boxel:
     * the region-relative letter-code offset plus the region origin in boxels.
     * Throws when the region cannot be resolved or the letter code lies outside
     * the region, so encoders fail loudly instead of emitting a wrong sector.
     */
    private absoluteBoxel(): { x: number; y: number; z: number } {
        const reg = this.region;
        const boxelSize = 320 << this.sizeClass; // internal units per boxel edge

        if (reg.x0 < 0 || reg.y0 < 0 || reg.z0 < 0) {
            throw new Error(`Unknown sector: ${this.regionName}`);
        }

        const mid =
            ((this.mid3 * 26 + this.mid2) * 26 + this.mid1b) * 26 + this.mid1a;
        if (mid > 0x1fffff) {
            // Only an oversized n1 can push mid past 21 bits (mid3 contributes mid3 * 26^3).
            throw new RangeError(`System index n1=${this.mid3} out of range in ${this.regionName}`);
        }
        const bx = mid & 0x7f;
        const by = (mid >> 7) & 0x7f;
        const bz = (mid >> 14) & 0x7f;
        // Letter codes count from the region origin snapped DOWN to the boxel
        // grid, so a region whose origin is not boxel-aligned reaches one boxel
        // further than sizeX/boxelSize — the bound must include the origin's
        // offset within its boxel.
        if (
            bx * boxelSize >= (reg.x0 % boxelSize) + reg.sizeX ||
            by * boxelSize >= (reg.y0 % boxelSize) + reg.sizeY ||
            bz * boxelSize >= (reg.z0 % boxelSize) + reg.sizeZ
        ) {
            throw new RangeError(
                `Letter code out of range for size class ${PGSystem.toLetter(this.sizeClass)} in ${this.regionName}`
            );
        }

        const x = bx + Math.floor(reg.x0 / boxelSize);
        const y = by + Math.floor(reg.y0 / boxelSize);
        const z = bz + Math.floor(reg.z0 / boxelSize);
        // A system address has 7 sector bits for x/z but only 6 for y; a
        // parseable name can still resolve to a sector outside that space, and
        // packing it would silently corrupt neighbouring fields.
        const sc = this.sizeClass;
        if (x >= 1 << (14 - sc) || y >= 1 << (13 - sc) || z >= 1 << (14 - sc)) {
            throw new RangeError(`Sector position of ${this.regionName} does not fit a system address`);
        }

        return { x, y, z };
    }

    toSystemAddress(): bigint {
        const sc = this.sizeClass;
        const { x, y, z } = this.absoluteBoxel();

        // The sequence (N2) field spans bits [44-3*sc, 55); the 9 bits above it
        // are the body ID, which a system address leaves at zero.
        const seqWidth = 11 + sc * 3;
        if (this.sequence < 0 || this.sequence >= 2 ** seqWidth) {
            throw new RangeError(`Sequence ${this.sequence} does not fit in ${seqWidth} bits`);
        }

        // Pack with BigInt: JS number bitwise operators truncate operands and
        // results to 32 bits (ToInt32), so any field reaching bit 31 or above
        // would be corrupted.
        return (
            BigInt(sc) |
            (BigInt(z) << 3n) |
            (BigInt(y) << BigInt(17 - sc)) |
            (BigInt(x) << BigInt(30 - sc * 2)) |
            (BigInt(this.sequence) << BigInt(44 - sc * 3))
        );
    }

    toModSystemAddress(): bigint {
        const sc = this.sizeClass;
        const bps = 7 - sc; // log2 of boxels per sector edge at this size class
        const boxelMask = 0x7f >> sc;
        const { x, y, z } = this.absoluteBoxel();

        if (this.sequence < 0 || this.sequence > 0x7fff) {
            throw new RangeError(`Sequence ${this.sequence} does not fit in the 15-bit mod-address field`);
        }

        // Split each axis into sector coordinate and within-sector boxel. Sectors
        // span 2^(7 - sizeClass) boxels at this size class, not a fixed 7 bits.
        // The sector-relative letter code is what fromModSystemAddress reads from
        // bits 16-36.
        const midOut =
            (x & boxelMask) | ((y & boxelMask) << 7) | ((z & boxelMask) << 14);

        // Pack with BigInt: JS number bitwise operators truncate operands and
        // results to 32 bits (ToInt32), so any field reaching bit 31 or above
        // would be corrupted.
        return (
            BigInt(this.sequence) |
            (BigInt(midOut) << 16n) |
            (BigInt(sc) << 37n) |
            (BigInt((x >> bps) & 0x7f) << 40n) |
            (BigInt((y >> bps) & 0x3f) << 47n) |
            (BigInt((z >> bps) & 0x7f) << 53n)
        );
    }

    static fromSystemAddress(systemaddress: bigint): PGSystem {
        const addr = systemaddress; // Keep as BigInt to preserve precision
        const sizeclass = Number(addr & BigInt(7));
        const z0 = Number((addr >> BigInt(3)) & BigInt(0x3fff >> sizeclass));
        const z1 = Number((addr >> BigInt(3)) & BigInt(0x7f >> sizeclass));
        const z2 = Number((addr >> BigInt(10 - sizeclass)) & BigInt(0x7f));
        const y0 = Number((addr >> BigInt(17 - sizeclass)) & BigInt(0x1fff >> sizeclass));
        const y1 = Number((addr >> BigInt(17 - sizeclass)) & BigInt(0x7f >> sizeclass));
        const y2 = Number((addr >> BigInt(24 - sizeclass * 2)) & BigInt(0x3f));
        const x0 = Number((addr >> BigInt(30 - sizeclass * 2)) & BigInt(0x3fff >> sizeclass));
        const x1 = Number((addr >> BigInt(30 - sizeclass * 2)) & BigInt(0x7f >> sizeclass));
        const x2 = Number((addr >> BigInt(37 - sizeclass * 3)) & BigInt(0x7f));
        // The sequence (N2) field is 11 + 3*sizeclass bits wide, ending at bit 55
        // where the 9-bit body ID starts.
        const seq = Number(
            (addr >> BigInt(44 - sizeclass * 3)) & ((1n << BigInt(11 + sizeclass * 3)) - 1n)
        );

        const regionname = PGSectors.getSectorName(
            new ByteXYZ(x2, y2, z2)
        );
        const mid = x1 | (y1 << 7) | (z1 << 14);
        const mid1a = mid % 26;
        const mid1b = Math.trunc(mid / 26) % 26;
        const mid2 = Math.trunc(mid / (26 * 26)) % 26;
        const mid3 = Math.trunc(mid / (26 * 26 * 26));

        const sys = new PGSystem();
        sys.regionName = regionname;
        sys.mid1a = mid1a;
        sys.mid1b = mid1b;
        sys.mid2 = mid2;
        sys.mid3 = mid3;
        sys.sizeClass = sizeclass;
        sys.sequence = seq;
        return sys;
    }

    static fromModSystemAddress(systemaddress: bigint): PGSystem {
        const addr = systemaddress; // Keep as BigInt to preserve precision
        const seq = Number(addr & BigInt(0x7fff));
        const mid = Number((addr >> BigInt(16)) & BigInt(0x1fffff));
        const sizeclass = Number((addr >> BigInt(37)) & BigInt(7));
        const x2 = Number((addr >> BigInt(40)) & BigInt(0x7f));
        const y2 = Number((addr >> BigInt(47)) & BigInt(0x3f));
        const z2 = Number((addr >> BigInt(53)) & BigInt(0x7f));

        const regionname = PGSectors.getSectorName(
            new ByteXYZ(x2, y2, z2)
        );
        const mid1a = mid % 26;
        const mid1b = Math.trunc(mid / 26) % 26;
        const mid2 = Math.trunc(mid / (26 * 26)) % 26;
        const mid3 = Math.trunc(mid / (26 * 26 * 26));

        const sys = new PGSystem();
        sys.regionName = regionname;
        sys.mid1a = mid1a;
        sys.mid1b = mid1b;
        sys.mid2 = mid2;
        sys.mid3 = mid3;
        sys.sizeClass = sizeclass;
        sys.sequence = seq;
        return sys;
    }
}
