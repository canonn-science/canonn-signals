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

        return `${this.regionName} ${mid1a}${mid1b}-${mid2} ${size}${mid3}-${seq}`;
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

            const mid3Str = _s.substring(i + 1, vend - i + 1);
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

    toSystemAddress(): bigint {
        const reg = this.region;

        const mid =
            ((this.mid3 * 26 + this.mid2) * 26 + this.mid1b) * 26 + this.mid1a;
        const x = (mid & 0x7f) + Math.floor(reg.x0 / (320 << this.sizeClass));
        const y =
            ((mid >> 7) & 0x7f) + Math.floor(reg.y0 / (320 << this.sizeClass));
        const z =
            ((mid >> 14) & 0x7f) + Math.floor(reg.z0 / (320 << this.sizeClass));
        const seq = this.sequence;

        const result =
            this.sizeClass |
            (z << 3) |
            (y << (17 - this.sizeClass)) |
            (x << (30 - this.sizeClass * 2)) |
            (seq << (44 - this.sizeClass * 3));

        return BigInt(result);
    }

    toModSystemAddress(): bigint {
        const reg = this.region;

        const mid =
            ((this.mid3 * 26 + this.mid2) * 26 + this.mid1b) * 26 + this.mid1a;
        const x = (mid & 0x7f) + Math.floor(reg.x0 / (320 << this.sizeClass));
        const x1 = x & 0x7f;
        const x2 = (x >> 7) & 0x7f;
        const y =
            ((mid >> 7) & 0x7f) + Math.floor(reg.y0 / (320 << this.sizeClass));
        const y1 = y & 0x7f;
        const y2 = (y >> 7) & 0x3f;
        const z =
            ((mid >> 14) & 0x7f) + Math.floor(reg.z0 / (320 << this.sizeClass));
        const z1 = z & 0x7f;
        const z2 = (z >> 7) & 0x7f;
        const seq = this.sequence;
        const szclass = this.sizeClass;

        const result =
            seq |
            (x1 << 16) |
            (y1 << 23) |
            (z1 << 30) |
            (szclass << 37) |
            (x2 << 40) |
            (y2 << 47) |
            (z2 << 53);

        return BigInt(result);
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
        const seq = Number((addr >> BigInt(44 - sizeclass * 3)) & BigInt(0x7fff));

        const regionname = PGSectors.getSectorName(
            new ByteXYZ(x2, y2, z2)
        );
        const mid = x1 | (y1 << 7) | (z1 << 14);
        const mid1a = mid % 26;
        const mid1b = Math.floor((mid / 26) % 26);
        const mid2 = Math.floor((mid / (26 * 26)) % 26);
        const mid3 = Math.floor(mid / (26 * 26 * 26));

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
        const mid1b = Math.floor((mid / 26) % 26);
        const mid2 = Math.floor((mid / (26 * 26)) % 26);
        const mid3 = Math.floor(mid / (26 * 26 * 26));

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
