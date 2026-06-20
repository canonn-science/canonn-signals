# Multi-Body System Badge Test

## Function: `getMultiBodySystemBadge()`

This function identifies barycentres that have 3 or more child bodies and returns appropriate labels:

### Labels:
- 3 bodies: **Trinary**
- 4 bodies: **Quaternary** 
- 5 bodies: **Quinary**
- 6 bodies: **Senary**
- 7 bodies: **Septenary**
- 8 bodies: **Octonary**
- 9 bodies: **Nonary**
- 10 bodies: **Denary**
- 10+ bodies: **X-body system**

### Implementation:
1. Only shows badge for barycentres (`type === 'Barycentre'`)
2. Counts direct child bodies (excluding rings and belts)
3. Requires 3+ bodies to display badge
4. Returns `{ label: string, count: number }` or `null`

### Usage:
The badge appears in the system-body component title with orange styling and tooltip showing "X bodies: Label".

### Test Cases:
- Barycentre with 2 bodies: No badge
- Barycentre with 3 bodies: "Trinary" badge
- Barycentre with 5 bodies: "Quinary" badge
- Non-barycentre bodies: No badge
- Bodies with only rings/belts: Not counted