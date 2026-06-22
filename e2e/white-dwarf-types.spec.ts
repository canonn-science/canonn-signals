import { test, expect, type Page } from '@playwright/test';
import { loadFixtureSystem } from './support/system-fixture';

/**
 * Deterministic, data-driven tests for the white-dwarf spectral-type modal.
 *
 * Each case is a real system (sourced from the Spansh dump, one per white-dwarf
 * classification the game actually uses) saved as a trimmed biostats fixture. The
 * network is stubbed so the exact body renders offline. For every type we assert:
 *  - the header shows the body's subtype (e.g. "White Dwarf (DA) Star"),
 *  - clicking the subtype opens the "White Dwarf Spectral Types" modal listing all rows,
 *  - the modal highlights exactly the row for the star's type (the generic,
 *    unclassified "D" type maps to the catalogue's general "D" row).
 *
 * To cover another type: add its biostats JSON to `fixtures/` and a row here.
 */

/** All catalogue rows the modal must list, in display order. */
const CATALOGUE_ROWS = ['D', 'DA', 'DB', 'DC', 'DO', 'DQ', 'DZ', 'DX', 'DAZ / DBZ / etc.', 'DAP / DBP'];

interface WhiteDwarfCase {
  /** Spectral code shown in the subtype (e.g. the `DA` in "White Dwarf (DA) Star"). */
  code: string;
  fixture: string;
  systemName: string;
  id64: number;
  /** `bodyId` of the white-dwarf body in the fixture. */
  bodyId: number;
  /** The catalogue row label the modal should highlight. */
  highlight: string;
}

const CASES: WhiteDwarfCase[] = [
  { code: 'D',   fixture: 'white-dwarf-d.json',          systemName: "van Maanen's Star",      id64: 670685996457,   bodyId: 0, highlight: 'D' },
  { code: 'DA',  fixture: 'white-dwarf-da.json',         systemName: 'Sirius',                 id64: 121569805492,   bodyId: 2, highlight: 'DA' },
  { code: 'DA',  fixture: 'phoi-scraa-hh-v-f2-67.json',  systemName: 'Phoi Scraa HH-V f2-67',  id64: 36106171581,    bodyId: 2, highlight: 'DA' },
  { code: 'DAB', fixture: 'white-dwarf-dab.json',        systemName: 'Thalassa',               id64: 1591008561515,  bodyId: 2, highlight: 'DA' },
  { code: 'DAV', fixture: 'white-dwarf-dav.json',        systemName: 'Ceramix',                id64: 1728447514987,  bodyId: 2, highlight: 'DA' },
  { code: 'DAZ', fixture: 'white-dwarf-daz.json',        systemName: 'LHS 235',                id64: 18263408977313, bodyId: 1, highlight: 'DAZ / DBZ / etc.' },
  { code: 'DB',  fixture: 'white-dwarf-db.json',         systemName: 'HIP 44463',              id64: 422777473379,   bodyId: 2, highlight: 'DB' },
  { code: 'DBV', fixture: 'white-dwarf-dbv.json',        systemName: 'HIP 118062',             id64: 1762857552243,  bodyId: 2, highlight: 'DB' },
  { code: 'DBZ', fixture: 'white-dwarf-dbz.json',        systemName: 'HD 171804',              id64: 1293944052,     bodyId: 2, highlight: 'DAZ / DBZ / etc.' },
  { code: 'DC',  fixture: 'white-dwarf-dc.json',         systemName: 'Stein 2051',             id64: 16063848850849, bodyId: 2, highlight: 'DC' },
  { code: 'DCV', fixture: 'white-dwarf-dcv.json',        systemName: 'HIP 37327',              id64: 216686135643,   bodyId: 2, highlight: 'DC' },
  { code: 'DQ',  fixture: 'white-dwarf-dq.json',         systemName: 'Procyon',                id64: 800751356267,   bodyId: 2, highlight: 'DQ' },
];

/** The white-dwarf body's own header (not a nested child body's). */
function bodyHeader(page: Page, bodyId: number) {
  return page.locator(`#body-${bodyId} > .body-title`);
}

test.describe('White dwarf spectral-type subtype and modal (fixtures)', () => {
  for (const wd of CASES) {
    test(`${wd.code} — ${wd.systemName}`, async ({ page }) => {
      await loadFixtureSystem(page, { fixture: wd.fixture, systemName: wd.systemName, id64: wd.id64 });

      // The body header shows the clickable subtype carrying the spectral code.
      const subType = bodyHeader(page, wd.bodyId).locator('span.clickable').filter({ hasText: 'White Dwarf' });
      await expect(subType).toContainText(`White Dwarf (${wd.code}) Star`);

      // Clicking the subtype opens the spectral-types modal.
      await subType.click();
      const dialog = page.locator('app-white-dwarf-types-dialog');
      await expect(dialog.locator('[mat-dialog-title]')).toHaveText('White Dwarf Spectral Types');

      // It lists every catalogue row, in order.
      const rowHeaders = dialog.locator('.spectral-table tbody tr th');
      await expect(rowHeaders).toHaveText(CATALOGUE_ROWS);

      // It highlights exactly the star's type — one row, the right one.
      const highlighted = dialog.locator('.spectral-table tbody tr.highlight');
      await expect(highlighted).toHaveCount(1);
      await expect(highlighted.locator('th')).toHaveText(wd.highlight);

      await dialog.getByRole('button', { name: 'Close' }).click();
      await expect(dialog).toHaveCount(0);
    });
  }
});
