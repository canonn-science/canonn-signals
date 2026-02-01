import { PGSectors, ByteXYZ } from './src/assets/pgnames/PGSectors';
import { PGSystem } from './src/assets/pgnames/PGSystem';

// Test for HD 205370
const id64 = BigInt(10577693187);
console.log('Testing id64:', id64);

const pgSystem = PGSystem.fromSystemAddress(id64);
console.log('PGSystem result:', pgSystem);

// Test sector name generation directly
const coords = new ByteXYZ(39, 30, 20);
const sectorName = PGSectors.getSectorName(coords);
console.log('Sector name for (39, 30, 20):', sectorName);

// Calculate offset
const offset = 39 + 30 * 128 + 20 * 16384;
console.log('Offset:', offset);

// Expected: "Blae Eock KC-C d0"
