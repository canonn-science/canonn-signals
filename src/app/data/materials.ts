/**
 * Raw-material reference data: maps each Elite Dangerous surface material to its
 * chemical-symbol abbreviation and a rarity-grade badge class. Extracted from
 * SystemBodyComponent so the table is plain data, not embedded in a view.
 */
export interface MaterialInfo {
  /** Badge CSS class encoding the material's rarity grade. */
  grade: string;
  /** Chemical-symbol abbreviation shown on the badge. */
  abbrev: string;
}

export const MATERIAL_DATA: { [material: string]: MaterialInfo } = {
  // Grade 1 (Very Rare)
  'Antimony': { grade: 'badge-mat1', abbrev: 'Sb' },
  'Polonium': { grade: 'badge-mat1', abbrev: 'Po' },
  'Ruthenium': { grade: 'badge-mat1', abbrev: 'Ru' },
  'Selenium': { grade: 'badge-mat1', abbrev: 'Se' },
  'Technetium': { grade: 'badge-mat1', abbrev: 'Tc' },
  'Tellurium': { grade: 'badge-mat1', abbrev: 'Te' },
  'Yttrium': { grade: 'badge-mat1', abbrev: 'Y' },
  // Grade 2 (Rare)
  'Cadmium': { grade: 'badge-mat2', abbrev: 'Cd' },
  'Mercury': { grade: 'badge-mat2', abbrev: 'Hg' },
  'Molybdenum': { grade: 'badge-mat2', abbrev: 'Mo' },
  'Niobium': { grade: 'badge-mat2', abbrev: 'Nb' },
  'Tin': { grade: 'badge-mat2', abbrev: 'Sn' },
  'Vanadium': { grade: 'badge-mat2', abbrev: 'V' },
  // Grade 3 (Uncommon)
  'Arsenic': { grade: 'badge-mat3', abbrev: 'As' },
  'Chromium': { grade: 'badge-mat3', abbrev: 'Cr' },
  'Germanium': { grade: 'badge-mat3', abbrev: 'Ge' },
  'Manganese': { grade: 'badge-mat3', abbrev: 'Mn' },
  'Phosphorus': { grade: 'badge-mat3', abbrev: 'P' },
  'Tungsten': { grade: 'badge-mat3', abbrev: 'W' },
  'Zinc': { grade: 'badge-mat3', abbrev: 'Zn' },
  'Zirconium': { grade: 'badge-mat3', abbrev: 'Zr' },
  // Grade 4 (Common)
  'Carbon': { grade: 'badge-mat4', abbrev: 'C' },
  'Iron': { grade: 'badge-mat4', abbrev: 'Fe' },
  'Nickel': { grade: 'badge-mat4', abbrev: 'Ni' },
  'Sulphur': { grade: 'badge-mat4', abbrev: 'S' },
};
