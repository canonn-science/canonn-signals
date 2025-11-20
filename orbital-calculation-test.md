# Orbital Position Calculation Verification

## Mathematical Verification

The `orbitalElementsToCartesian` function implements the standard Keplerian orbital elements to Cartesian coordinates conversion. Here's the verification:

### 1. Kepler's Equation Solution
```typescript
// Solve M = E - e*sin(E) using fixed-point iteration
let E = M;
for (let iter = 0; iter < 10; iter++) {
  E = M + e * Math.sin(E);
}
```
✅ **Valid**: This is Newton's method simplified for circular orbits, converges in ~10 iterations for typical eccentricities

### 2. True Anomaly Calculation
```typescript
const nu = 2 * Math.atan2(
  Math.sqrt(1 + e) * Math.sin(E / 2),
  Math.sqrt(1 - e) * Math.cos(E / 2)
);
```
✅ **Valid**: Standard formula ν = 2·arctan(√[(1+e)/(1-e)]·tan(E/2))

### 3. Distance from Focus
```typescript
const r = a * (1 - e * Math.cos(E));
```
✅ **Valid**: Standard formula r = a(1 - e·cos(E))

### 4. Rotation Matrices
```typescript
const x = (cosO * cosW - sinO * sinW * cosI) * xOrb + (-cosO * sinW - sinO * cosW * cosI) * yOrb;
const y = (sinO * cosW + cosO * sinW * cosI) * xOrb + (-sinO * sinW + cosO * cosW * cosI) * yOrb;
const z = (sinW * sinI) * xOrb + (cosW * sinI) * yOrb;
```
✅ **Valid**: This is the standard rotation matrix R_z(Ω) · R_x(i) · R_z(ω) applied to orbital plane coordinates

## Test Cases

### Test 1: Circular Orbit at 1 AU (Earth-like)
**Input:**
- a = 1.0 AU
- e = 0.0
- i = 0°
- ω = 0°
- Ω = 0°
- M = 0° (at periapsis)

**Expected:** x = 1 AU = 149,597,870.7 km, y = 0, z = 0

**Calculation:**
- E = M = 0
- ν = 0
- r = 1.0 × (1 - 0) = 1.0 AU
- xOrb = 1.0 × cos(0) = 1.0 AU
- yOrb = 1.0 × sin(0) = 0
- x = 1.0 AU × 1 = 149,597,870.7 km ✅
- y = 0 ✅
- z = 0 ✅

### Test 2: Eccentric Orbit at Apoapsis
**Input:**
- a = 1.0 AU
- e = 0.5
- i = 0°
- ω = 0°
- Ω = 0°
- M = 180° (at apoapsis)

**Expected:** x = -1.5 AU (apoapsis distance = a(1+e))

**Calculation:**
- E ≈ 180° (π radians)
- r = 1.0 × (1 - 0.5 × cos(π)) = 1.0 × (1 - 0.5 × (-1)) = 1.5 AU ✅
- ν = 180°
- xOrb = -1.5 AU ✅

### Test 3: Inclined Orbit
**Input:**
- a = 1.0 AU
- e = 0.0
- i = 90° (perpendicular to reference plane)
- ω = 0°
- Ω = 0°
- M = 90°

**Expected:** z-component should be non-zero

**Calculation:**
- E = 90° (π/2)
- r = 1.0 AU
- ν = 90°
- xOrb = 0
- yOrb = 1.0 AU
- With i = 90°: z = yOrb × sin(i) = 1.0 AU ✅
- x = 0, y = 0 ✅

## Verification Method

You can verify the calculations using these approaches:

### 1. Cross-check with NASA JPL HORIZONS
Use NASA's HORIZONS system to get positions for known bodies and compare:
- https://ssd.jpl.nasa.gov/horizons/

### 2. Compare with PyEphem or Skyfield (Python libraries)
```python
from skyfield.api import load
from skyfield.elementslib import osculating_elements_of

# Get actual planetary positions and compare
```

### 3. Unit Test with Simple Cases
Create a TypeScript test that verifies:
- Circular orbit returns correct radius
- Periapsis/apoapsis distances match a(1±e)
- 90° mean anomaly for circular orbit gives distance = a

### 4. Visual Verification
Plot the orbits in 3D and verify:
- Ellipse shape is correct
- Inclination angle is correct
- Orbital plane rotation matches Ω

## Known Limitations

1. **Kepler Equation Solver**: Uses fixed-point iteration instead of Newton-Raphson. For very high eccentricities (e > 0.9), may need more iterations.

2. **Mean Anomaly at Current Time**: The code samples at discrete intervals (24 positions). Real positions vary over time.

3. **Coordinate Convention**: Elite Dangerous uses negative argument of periapsis and ascending node. The code correctly negates these:
   ```typescript
   const argP = bodyData.argOfPeriapsis !== undefined ? -bodyData.argOfPeriapsis : 0;
   const node = bodyData.ascendingNode !== undefined ? -bodyData.ascendingNode : 0;
   ```

## Conclusion

The orbital calculations use **standard, well-established formulas** from celestial mechanics. The implementation matches textbook equations for:
- Kepler's equation solution
- True anomaly calculation  
- Orbital radius
- 3D rotation matrices (Ω, i, ω)

These are the same formulas used in orbital mechanics software, NASA mission planning, and astronomy applications.
