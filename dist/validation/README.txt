Engineering Studio manufacturing acceptance coupon

Reference geometry: 30 x 20 x 5 mm, Z up, 6 mm through-hole centred at X=10 Y=10 mm. Circular boundaries have 48 facets. The JSON includes the kernel volume and actual exported bounds.

1. Open coupon.stl in the intended CAD application or slicer. Record application name and exact version, units, imported bounds and mesh warnings in coupon-acceptance.json.
2. Confirm millimetres and Z up. Inspect the through-hole and closed walls. Do not auto-scale the reference to fit the build plate.
3. Select a suitable material, machine and process. Choose acceptance tolerances before fabrication and record the relevant settings. Inspect toolpaths/layers for omissions, unsupported regions and unwanted fills.
4. Manufacture a physical coupon, then record the instrument and measured length, width, thickness and hole diameter (multiple directions/locations). Account for measurement uncertainty.
5. Compare measurements with the process tolerances chosen in step 3. Record failures and adjustments. Only a human with the actual evidence can change manufacturingAccepted to true.

Independent parser checks do not replace these steps. No CAD/slicer execution or physical manufacturing acceptance has been performed by the application.
