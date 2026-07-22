import { GREEN_GAS_GIANTS } from './green-gas-giants.generated';

/**
 * EDAstro's POI CSV records some Green Gas Giants with only the system name in the
 * "Name" column (no body suffix) — that string is indistinguishable from the system's
 * own star, so matching it as-is would silently tag the star instead of the giant.
 * Each override here was resolved against live Spansh data (the one gas-giant body in
 * that system matching the reference photo's body designation) and confirmed unambiguous.
 * Keyed by system name, case-insensitive.
 */
const AMBIGUOUS_BODY_OVERRIDES: Readonly<Record<string, string>> = {
    'floasly te-x d2-25': 'Floasly TE-X d2-25 B 1',
    'boelts xh-c c29-854': 'Boelts XH-C c29-854 AB 1',
    'eor aowsy gr-w e1-1381': 'Eor Aowsy GR-W e1-1381 AB 1',
    'hypao chraea vq-t d4-8': 'Hypao Chraea VQ-T d4-8 B 1',
    'cryaa ain zj-r e4-4': 'Cryaa Ain ZJ-R e4-4 A 3',
    'byoomao ly-g d11-9374': 'Byoomao LY-G d11-9374 A 4',
    'aemonz ut-r d4-36': 'Aemonz UT-R d4-36 10 a',
    'noijo yg-t d4-97': 'Noijo YG-T d4-97 A 1',
    'juenoea jn-j d9-7667': 'Juenoea JN-J d9-7667 AB 5',
    'eos aowsy fg-y d747': 'Eos Aowsy FG-Y d747 BC 4',
    'eodgorph lm-w e1-167': 'Eodgorph LM-W e1-167 BCD 8',
    'graea hypue bx-u b6-0': 'Graea Hypue BX-U b6-0 AB 3',
    'plaa ain yh-g b13-0': 'Plaa Ain YH-G b13-0 A 8',
    'flyue bloae qn-y c2-0': 'Flyue Bloae QN-Y c2-0 C 1',
    'dryooe groa qx-f c16': 'Dryooe Groa QX-F c16 A 7',
    'thaileia pj-o d7-74': 'Thaileia PJ-O d7-74 D 3',
    'wregoe nd-z d1-0': 'Wregoe ND-Z d1-0 C 7',
    'plieliae sm-c c29-11': 'Plieliae SM-C c29-11 B 3',
    'eowyg ail dr-v d2-0': 'Eowyg Ail DR-V d2-0 A 1',
    'gludgoea aa-a e25': 'Gludgoea AA-A e25 ABCD 3',
    'wredgo bq-y f0': 'Wredgo BQ-Y f0 D 8 a',
    'pheia aewsy lv-y d11': 'Pheia Aewsy LV-Y d11 B 4',
    'phrio hype bb-w e2-8': 'Phrio Hype BB-W e2-8 12 a',
};

export interface ResolvedGreenGasGiant {
    system: string;
    /** The real in-game body name — corrected via {@link AMBIGUOUS_BODY_OVERRIDES} where the CSV only recorded the system. */
    body: string;
    /** Asset slug, derived from the CSV's original (possibly ambiguous) body field — matches the photo filename on disk. */
    slug: string;
}

export const RESOLVED_GREEN_GAS_GIANTS: readonly ResolvedGreenGasGiant[] = GREEN_GAS_GIANTS.map(g => ({
    system: g.system,
    body: g.body.toLowerCase() === g.system.toLowerCase()
        ? (AMBIGUOUS_BODY_OVERRIDES[g.system.toLowerCase()] ?? g.body)
        : g.body,
    slug: slugify(g.body),
}));

/** The catalogued Green Gas Giant matching `bodyName`, or `null` if it isn't one. */
export function findGreenGasGiant(bodyName: string): ResolvedGreenGasGiant | null {
    return RESOLVED_GREEN_GAS_GIANTS.find(g => g.body.toLowerCase() === bodyName.toLowerCase()) ?? null;
}

/** Whether `bodyName` is a catalogued Green Gas Giant. */
export function isGreenGasGiant(bodyName: string): boolean {
    return findGreenGasGiant(bodyName) !== null;
}

/**
 * Real, square-cropped reference photo for a body listed in {@link GREEN_GAS_GIANTS},
 * relative to `assets/` (e.g. "bodies/green-gas-giants/aemonz-ut-r-d4-36.png"), or
 * `null` if the body isn't one of the catalogued Green Gas Giants.
 */
export function getGreenGasGiantImagePath(bodyName: string): string | null {
    const entry = findGreenGasGiant(bodyName);
    return entry ? `bodies/green-gas-giants/${entry.slug}.png` : null;
}

function slugify(name: string): string {
    return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
