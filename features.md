# Canonn Signals - Features

## Overview
Canonn Signals is an Angular-based web application designed for Elite Dangerous commanders to view, analyze, and explore stellar system data. It displays composition-scanned signals in a system and shows predicted signals based on statistical analysis.

---

## Core Features

### System Search & Display
- **System Search**: Search for any stellar system by name with autocomplete suggestions
- **Real-time Data**: Fetches data from Spansh API and Galactic Exploration Catalog (GEC)
- **System Overview**: Display complete system information including:
  - System allegiance and coordinates
  - Star types and configurations
  - All celestial bodies (stars, planets, moons, rings, belts)
  - Hierarchical body structure with parent-child relationships
  - Barycentre detection and display

### Body Classification & Visualization
- **Body Type Detection**: Automatically identifies and displays:
  - Stars (all spectral classes)
  - Planets (terrestrial, gas giants, ice worlds, etc.)
  - Moons and submoons
  - Rings and belts
  - Barycentres (orbital centers)
- **Visual Body Images**: Dynamic body images based on type, atmosphere, and composition
- **Corona Effects**: Special visual effects for certain stellar bodies
- **Subtype Classification**: Detailed subtypes for all body classes

### Signals Detection & Display
Organized into five main categories with dedicated sections:

#### 1. **Signals (Human & Other)**
- Human signals ($SAA_SignalType_Human)
- Other signals ($SAA_SignalType_Other)
- Signal counts with recorded/total display
- Category header shows icons when signals are present

#### 2. **Geology Signals**
- Geological signal detection and display
- Individual signal listing
- Total signals counter (recorded/total)
- Visual icon indicators

#### 3. **Biology Signals**
- Biological signal detection with Codex integration
- **Intelligent Prediction System**:
  - Confirmed biology signals from scan data
  - Predicted biology based on statistics (marked as guesses)
  - Genus-level predictions when specific species unknown
- **Accurate Counting**: Excludes predictions from "recorded" count
- Visual display with species names and images
- Color-coded entries (confirmed vs. predicted)

#### 4. **Thargoid Signals**
- Thargoid presence detection
- Signal listing and counting
- Dedicated category section

#### 5. **Guardian Signals**
- Guardian site detection
- Signal listing and counting
- Dedicated category section

### Astronomical Calculations

#### Orbital Mechanics
- **Orbital Parameters**: Display of:
  - Semi-major axis
  - Orbital eccentricity
  - Orbital inclination
  - Argument of periapsis
  - Ascending node
  - Mean anomaly
  - Orbital period
- **Orbital Position Calculations**:
  - Next periapsis date/time
  - Next apoapsis date/time
  - Current orbital position
  - Time-based orbital predictions

#### Roche Limit Analysis
- **Dual Roche Limits**: Calculates both:
  - Rigid body Roche limit (factor: 1.26)
  - Fluid body Roche limit (factor: 2.456)
- **Visual Chart Display**: Interactive canvas-based visualization showing:
  - Parent body position and radius
  - Rigid Roche limit zone (red)
  - Fluid Roche limit zone (yellow)
  - Body's orbital range (periapsis to apoapsis)
  - Ring positions for parent bodies with rings
  - Proper density formatting with locale separators
- **Breach Detection**: Automatic detection when body breaches Roche limits
- **Shepherd Moon Detection**: Shows Roche limits for bodies orbiting within or near parent ring systems (within 20% of outer ring radius)
- **Anomaly Badges**: Visual indicators for Roche limit violations

#### Hill Sphere Analysis
- **Hill Limit Calculation**: Determines gravitational sphere of influence
- **Breach Detection**: Identifies when child orbits exceed parent's Hill sphere
- **Anomaly Flagging**: Highlights anomalous orbital configurations
- **Educational Dialogs**: Explains Hill sphere concept and violations

#### Spin-Orbit Resonance
- **Resonance Detection**: Identifies orbital-rotational coupling:
  - 1:1 resonance (tidal locking)
  - 3:2 resonance (Mercury-like)
  - 2:1 resonance
  - Other ratios
- **Visual Indicators**: Badges showing resonance type
- **Tidal Lock Detection**: Special icon for tidally locked bodies

#### Trojan & Rosette Detection
- **Lagrange Point Analysis**: Detects bodies at L4/L5 points
- **Trojan Identification**: Flags co-orbital configurations
- **Rosette/Klemperer Detection**: Identifies rare stable orbital arrangements
- **Visual Badges**: Special indicators for these rare phenomena

### Physical Properties

#### Composition Analysis
- **Solid Composition**: Ice, Rock, Metal percentages
- **Atmospheric Composition**: Detailed gas percentages
- **Atmosphere Classification**: Atmosphere type with composition tooltip
- **Visual Tooltips**: Hover for detailed breakdowns

#### Physical Characteristics
- **Mass Calculations**:
  - Earth masses for planets
  - Solar masses for stars
  - Intelligent formatting (scientific notation for extreme values)
- **Radius Display**: Body radius in kilometers
- **Gravity**: Surface gravity in G
- **Temperature**: Surface temperature in Kelvin
- **Pressure**: Surface/atmospheric pressure
- **Axial Tilt**: Rotational axis inclination
- **Rotation Period**: Spin rate and day length

### Landability & Exploration

#### Landing Capability
- **Landable Detection**: Identifies bodies suitable for landing
- **Safety Classification**: Color-coded badges:
  - Green: Safe for landing (low gravity, no/thin atmosphere)
  - Orange: Caution required (moderate gravity or thin atmosphere)
  - Red: Dangerous (high gravity and/or thick atmosphere)
- **Odyssey Compatibility**: Special badge for atmospheric landable worlds (requires Odyssey DLC)
- **Safety Tooltips**: Hover for gravity and atmosphere warnings

#### Terraforming
- **Terraforming State**: Shows current terraforming status
- **Terraformable Detection**: Identifies candidate worlds
- **Visual Badges**: Quick reference for terraform potential

### Mining & Resources

#### Ring & Belt Analysis
- **Ring Properties**: For planetary rings, displays:
  - Ring type (icy, rocky, metallic, metal-rich)
  - Inner and outer radius
  - Ring mass
  - Density calculations
- **Resource Classification**: Categorizes mining resources:
  - 💎 Gemstones (Painite, Low Temperature Diamonds, etc.)
  - ⚙️ Metals (Platinum, Palladium, Osmium, etc.)
  - 🪨 Minerals (Bromellite, etc.)
  - ⚡ Fuel (Tritium)
- **Visual Icons**: Quick visual reference for resource types
- **Reserve Level**: Shows mining reserve quality when available
- **Material Badges**: Highlights valuable materials:
  - Grade 4 materials (purple badge)
  - Grade 3 materials (blue badge)
  - Grade 2 materials (green badge)
  - Grade 1 materials (gray badge)

#### Hotspot Detection
- **Hotspot Information**: (when available from data source)
- **Resource Concentration**: Mining efficiency indicators

### Stellar Classification

#### Neutron Star Analysis
- **Neutron Star Classification**: Special categorization:
  - Standard neutron stars
  - Anomalous neutron stars (rare cases with unusual properties)
- **Classification Badge**: Visual indicator with tooltip explanation
- **Boost Capability**: Information for FSD supercharging

#### Stellar Properties
- **Spectral Classification**: Full spectral type display (O, B, A, F, G, K, M, L, T, Y classes)
- **Luminosity Class**: Roman numeral designation
- **Solar Properties**:
  - Solar masses
  - Solar radius
  - Absolute magnitude
  - Surface temperature
  - Age of star

### Ring Visibility Analysis
- **Invisible Ring Detection**: Identifies rings that may not be visible in-game due to:
  - Thin density
  - Small mass
  - Large orbital radius
- **Visual Warning**: "Invisible" badge with explanation
- **Educational Dialog**: Explains why certain rings are invisible

### User Interface Features

#### Navigation & Organization
- **Hierarchical Display**: Bodies organized by orbital hierarchy
- **Expand/Collapse**: Individual body expansion
- **Bulk Expand/Collapse**: Expand or collapse all children of a body
- **Tree Structure**: Visual connection lines showing orbital relationships
- **Smart Auto-Expansion**: Bodies with signals or anomalies auto-expand
- **Sticky Positioning**: Keep important data visible while scrolling

#### Interactive Elements
- **Body Dialogs**: Click-through for detailed information
- **JSON Viewer**: View raw body data with syntax highlighting
- **Copy JSON**: Right-click to copy body data to clipboard
- **Tooltips**: Comprehensive hover information throughout
- **Material Badges**: Hover to see full material names

#### Data Display Enhancements
- **Label-Value Pairs**: Consistent formatting throughout
- **Locale Formatting**: Numbers formatted with thousand separators
- **Precision Control**: Appropriate decimal places for different measurements
- **Units Display**: Clear unit indicators (km, G, K, days, etc.)
- **Null Handling**: Graceful handling of missing data with fallback values
- **Color Coding**: Meaningful color schemes for different data types

### Visualization & Charts

#### Roche Limit Charts
- **Interactive Canvas**: HTML5 canvas-based visualization
- **Multi-layer Display**:
  - Parent body core
  - Rigid Roche limit boundary
  - Fluid Roche limit boundary
  - Body orbital path with radius
  - Ring systems (if present)
- **Dynamic Legends**: Context-aware labels (body vs. ring position)
- **Density Display**: Formatted with proper precision

#### Orbital Visualizations
- **Orbit Paths**: Shows periapsis to apoapsis range
- **Body Radius**: Includes body size in orbital display
- **Ring Positions**: Comparative ring and body positions
- **Scale Indicators**: Proper scaling for visualization

### Data Integration

#### External APIs
- **Spansh Integration**: Primary data source for system information
- **Galactic Exploration Catalog**: Supplementary exploration data
- **EDDN Network**: Community-contributed data
- **Codex Database**: Biology classification and identification

#### Data Caching
- **Smart Caching**: Reduces API calls
- **Update Timestamps**: Displays data freshness
- **Offline Support**: Previously viewed systems remain accessible

### Educational Features
- **Explanatory Dialogs**: In-depth explanations for:
  - Hill sphere violations
  - Invisible rings
  - Roche limit mechanics
  - Orbital resonance
  - Trojan configurations
- **Tooltips**: Context-sensitive help throughout
- **Visual Learning**: Charts and diagrams for complex concepts

---

## Technical Features

### Performance
- **Angular 16**: Modern framework with optimized change detection
- **Lazy Loading**: Efficient component loading
- **Debounced Search**: Prevents excessive API calls
- **Smart Rendering**: Only renders visible/expanded bodies

### Responsive Design
- **Mobile Friendly**: Adapts to different screen sizes
- **Material Design**: Clean, modern UI following Material principles
- **Animations**: Smooth expand/collapse transitions
- **FontAwesome Icons**: Consistent iconography

### Data Accuracy
- **Precise Calculations**: Uses proper astronomical formulas
- **Unit Conversions**: Accurate conversions between different unit systems
- **Radian/Degree Handling**: Proper angular unit management
- **Timestamp Processing**: Accurate time-based calculations
- **Floating Point Precision**: Careful handling of numerical precision

---

## Future Enhancement Possibilities
- Advanced filtering and sorting options
- Bookmark favorite systems
- Route planning integration
- Multi-system comparison
- Export functionality (CSV, JSON)
- 3D orbital visualization
- Trade route optimization
- Exploration value calculations

---

*This application is maintained by the Canonn Research Group and the Elite Dangerous community.*
