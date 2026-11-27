VOXEL CARS FREE - 3 free cars from Voxel Cars
=============================================

A free sample of Voxel Cars: Camper Van, Taxi and Muscle Car.
These are the same files as in the full pack: the same rig, animations and textures.

  Voxel_Camper_Van   tall two-tone body, side-hinged tail door with the spare wheel, roof rack, rear bench; 32 moving objects
  Voxel_Taxi         four-door taxi hatchback, glowing TAXI roof sign, checker band, folding rear bench; 36 moving objects
  Voxel_Muscle_Car   two doors, V8 with a round air cleaner, hood scoop, black stripes, chrome bumpers; 31 moving objects

Folders: Textures, Parts, GLB, FBX, Blender, Roblox (take the one for your engine)

License: CC BY 4.0, see LICENSE.txt. Credit line for your game:
  Voxel Cars by Sneznyj 3D (sneznyj.com), CC BY 4.0

Want all of them? https://sneznyj.itch.io/voxel-cars
Custom models to order: https://sneznyj.com/custom/


NOTES FROM THE FULL VOXEL CARS README
------------------------------------------------------------
Below is the README of the full pack. It talks about all of the cars; the three here are the same
files, so the file layout, rig, animations and import tips apply to them as they are.

VOXEL CARS 2.0 - 24 blocky cars for games, every door opens and every part comes off
=====================================================================================

24 voxel cars: sports car, police car, taxi, pickups, off-roaders, vans, an ambulance, a hot rod, a dune buggy and
more. Every door, lid, window, seat, lever, pedal, wheel, wiper and gauge needle is its own object with its pivot right
on the real hinge, so in a game you only rotate or move that one object. Bumpers, plates, headlights, mirrors, tyres,
the engine, the tank and the battery are objects of their own too, so a game can take them off and put them back.

Which file do I need?
---------------------
  Unity, Unreal              FBX/<Car>.fbx        metres, textures embedded
  Godot, three.js, Babylon   GLB/<Car>.glb        glTF 2.0, textures inside, motion ranges in each node's "extras"
  Blender                    Blender/<Car>.blend  pose sliders: select the car's root empty ->
                                                  Object Properties -> Custom Properties (doors, hood, steer...)
  Roblox Studio              Roblox/<Car>.fbx     3x size (studs) for the 3D Importer, textures embedded

The pack comes as four archives (GLB, FBX, Blender, Roblox): take the one you need. Every archive also has
  Textures/   the 2048 px atlas of each car: colour (ambient occlusion baked in), metallic-roughness, emissive,
              and the paint mask (see "Repaint")
  Parts/      <Car>_parts.json: every object, its parent, pivot, motion axis and range (for your scripts)
The test drive (Voxel_Cars_v2.0_Test_Drive.zip) is a separate download: one HTML file, open it in a browser.

Conventions
-----------
Origin on the ground in the middle of the car. glTF axes: +Y up, +Z forward (the nose), +X is the car's left
(left-hand drive). Rotate or move only the object itself: local rotation = rest rotation x rotation(axis, angle);
for "translate" move it along its axis. Importers convert the axes to their own convention (Unity flips X, Blender
turns Y-up into Z-up); the hinge positions stay the same. Every moving part was swept through its whole range, also
several at once (all doors and lids open, seats back with the rear bench folded, doors open with the windows down):
nothing passes through anything. Bodies are mirror-symmetric except the driver's dashboard.

What moves (names are the same in every car)
--------------------------------------------
  Door_L, Door_R                         front doors, hinge on the front edge, open outwards (0..72 deg)
  RearDoor_L, RearDoor_R                 rear doors of the four-door cars
  Window_L, Window_R ...                 side glass slides down into its door (child of the door)
  Hood                                   hinge at the windshield, the front lifts up
  Trunk / Hatch / Tailgate / TailDoor    the rear opening of each car (see the car list)
  Glovebox                               lid drops open
  Seat_L, Seat_R                         slide on the rails; SeatBack_L / SeatBack_R recline (children of the seats)
  RearSeatBack                           rear bench backrest folds forward (four-door cars)
  Wheel_FL_Steer, Wheel_FR_Steer         steering knuckles turn around Y (-32..32 deg)
  Wheel_FL ... Wheel_RR                  wheels roll around the axle; the tyre (Tire_FL ...) is a child of its rim
  SteeringWheel                          turns with the steering (child of SteeringColumn)
  GearLever                              H-gate: forward/back and left/right
  Handbrake                              pulls up
  Pedal_Clutch, Pedal_Brake, Pedal_Gas   press down
  Wiper_L, Wiper_R                       sweep up the windshield (children of their pivots)
  Visor_L, Visor_R                       sun visors flip down (children of Roof)
  Needle_Speed, Needle_RPM               gauge needles, 0..270 deg = 0..240 km/h and 0..8000 rpm
  FuelDoor, FuelCap                      fuel filler door on the rear right quarter swings out, the cap unscrews

What comes off (objects of their own, no motion)
------------------------------------------------
  FrontBumper, RearBumper                bumpers
  FrontPlate, RearPlate                  number plates
  HeadLight_L, HeadLight_R               headlight lamps (a black socket stays in the body)
  Mirror_L, Mirror_R, Mirror_In          side mirrors and the inner mirror
  Tire_FL ... Tire_RR                    tyres come off their rims
  Wheel_SP, Tire_SP                      the spare wheel on a side-hinged tail door is a real wheel of the car
  Engine                                 engine block with its covers and air filter: lift it out of the bay
  FuelTank, Battery                      tank and battery in the trunk, cargo area or bed
  Exhaust, Horn, Gauges                  exhaust pipe, horns behind the grille, gauge cluster
  Roof                                   roof with the visors, dome light and anything on it
  LightBar, TaxiSign                     police / ambulance light bar, TAXI sign: set them on any roof
  Doors, Hood, Trunk ...                 every door, lid and seat comes off the same way
Tanks, engines, batteries, seats, steering wheels and handbrakes share one layout, so they fit every car: a tank fits
every tank spot (pivot: front bottom centre of the tank), an engine fits every engine bay (pivot: bottom centre of the
block). Doors, hood, rear lid and roof fit their own model.

Materials (switch each one's emission in your game)
---------------------------------------------------
  Body                      paint, chrome, interior, tyres: no glow
  Glass                     windshield, rear window, side windows (transparent)
  HeadLight                 headlights
  TailLight                 rear lights: dim for running lights, bright when braking
  ReverseLight              white reversing lights
  Indicator_L, Indicator_R  turn signals (front, side, rear)
  Dash                      gauges, radio display, needles
  InteriorLight             dome light and trunk / cargo light
  Siren_Red, Siren_Blue     police light bar (police car only)
  RoofSign                  TAXI roof sign (taxi only)

Repaint
-------
Textures/<Car>_paint_mask.png has the same layout as the colour atlas and tells what a repaint may change:
  red 255     body paint (outside, and where it shows in the cabin)
  green 255   second body colour (stripes, roof, two-tone)
  red 128     rust over the paint
  blue 255    seat cloth          blue 128   its darker trim
  red 64      bumpers and rims, taken over whole (green = the texel's own brightness, so a repaint keeps the shading)
  black       everything a spray can leaves alone: chrome, grille, lights, plates, lettering, the cabin's own trim
Multiply your new colour by the brightness of the colour atlas where the mask says so, and the panel lines, ambient
occlusion and dirt stay.

Test drive
----------
W/S gas, brake, reverse - A/D steer - Space handbrake - Q/E gears - C camera: chase, driver seat, orbit -
[ ] change car - 1 driver door, 2 passenger door, 3 hood, 4 rear opening, 5 glovebox, 6 windows, 7 visors,
8 rear doors, 9 rear seat, 0 open everything - F fuel door - L headlights - K police lights - T taxi sign -
Z/X turn signals - B hazards - V wipers - H horn - N day/night - R reset. Click any door, panel or seat on the car.
The page loads its 3D engine from the internet.

The cars (253,870 triangles for all 24, 8,102 to 16,618 per car)
------------------------------------------------------------
 1. Voxel Sports Car  (Voxel_Sports_Car)
    Two-door sports coupe: racing stripes, spoiler on the trunk lid, racing fuel cell.
    4.90 m long, about 1.50 m tall, 0.8 m wheels, wheelbase 2.60 m.
    2 doors, rear: trunk lid (Trunk); inline four, racing fuel cell 55 L.
    9,784 triangles, 14,202 vertices, 31 moving objects, 62 objects in all.
 2. Voxel Pickup Truck  (Voxel_Pickup_Truck)
    Two-door pickup: open bed with wheel humps, tailgate that drops flat, roll bar, chrome bumpers, V8.
    5.00 m long, about 1.60 m tall, 0.9 m wheels, wheelbase 3.05 m.
    2 doors, rear: tailgate (Tailgate); V8, big ribbed tank 65 L.
    9,988 triangles, 14,735 vertices, 31 moving objects, 62 objects in all.
 3. Voxel Police Car  (Voxel_Police_Car)
    Four-door police sedan: light bar (glowing materials Siren_Red / Siren_Blue), push bar, POLICE on the doors, folding rear bench.
    5.45 m long, about 1.62 m tall, 0.8 m wheels, wheelbase 3.05 m.
    4 doors, rear: trunk lid (Trunk); V8, steel tank 45 L.
    8,834 triangles, 13,149 vertices, 36 moving objects, 68 objects in all.
 4. Voxel Taxi  (Voxel_Taxi)
    Four-door taxi hatchback: glowing TAXI roof sign (material RoofSign, the sign is a part of its own), checker band, hatch with its glass, folding rear bench.
    4.70 m long, about 1.62 m tall, 0.8 m wheels, wheelbase 2.95 m.
    4 doors, rear: hatch with its glass (Hatch); inline four, steel tank 45 L.
    8,618 triangles, 12,848 vertices, 36 moving objects, 68 objects in all.
 5. Voxel Off-Road SUV  (Voxel_Offroad_SUV)
    Two-door off-roader: knobby tyres, side-hinged tail door with the spare wheel, roof rack, bull bar, fender flares.
    4.50 m long, about 1.97 m tall, 1.0 m wheels, wheelbase 2.55 m.
    2 doors, rear: side-hinged tail door with the spare wheel (TailDoor); inline six, big ribbed tank 65 L.
    16,618 triangles, 24,209 vertices, 31 moving objects, 63 objects in all.
 6. Voxel Roadster  (Voxel_Roadster)
    Two-seat roadster without a roof: frameless side windows, short windshield, fairings behind the seats.
    4.30 m long, about 1.35 m tall, 0.8 m wheels, wheelbase 2.50 m.
    2 doors, rear: trunk lid (Trunk); inline four, small steel tank 30 L.
    9,112 triangles, 13,182 vertices, 31 moving objects, 60 objects in all.
 7. Voxel Old Sedan  (Voxel_Old_Sedan)
    Four-door old sedan: faded paint with rust patches, chrome bumpers and grille, hubcaps, rusty fuel tank.
    5.30 m long, about 1.50 m tall, 0.8 m wheels, wheelbase 2.95 m.
    4 doors, rear: trunk lid (Trunk); inline four, old rusty tank 25 L.
    8,486 triangles, 12,640 vertices, 36 moving objects, 67 objects in all.
 8. Voxel Station Wagon  (Voxel_Station_Wagon)
    Four-door station wagon: wood panels on the sides, long roof with a rack, hatch with its glass, big cargo area.
    5.10 m long, about 1.62 m tall, 0.8 m wheels, wheelbase 3.25 m.
    4 doors, rear: hatch with its glass (Hatch); inline six, steel tank 45 L.
    8,632 triangles, 12,869 vertices, 36 moving objects, 67 objects in all.
 9. Voxel Camper Van  (Voxel_Camper_Van)
    Camper van: tall two-tone body, side windows, side-hinged tail door with the spare wheel, roof rack, rear bench and a long cargo area.
    5.20 m long, about 2.27 m tall, 0.9 m wheels, wheelbase 3.30 m.
    2 doors, rear: side-hinged tail door with the spare wheel (TailDoor); inline four, big ribbed tank 65 L.
    9,270 triangles, 13,808 vertices, 32 moving objects, 64 objects in all.
10. Voxel Muscle Car  (Voxel_Muscle_Car)
    Two-door muscle car: V8 with a round air cleaner, hood scoop, black stripes, chrome bumpers.
    5.30 m long, about 1.50 m tall, 0.8 m wheels, wheelbase 2.95 m.
    2 doors, rear: trunk lid (Trunk); V8, racing fuel cell 55 L.
    9,946 triangles, 14,459 vertices, 31 moving objects, 62 objects in all.
11. Voxel Dune Buggy  (Voxel_Dune_Buggy)
    Open dune buggy: roll cage, lifted body, knobby tyres, fender flares, short windshield.
    4.30 m long, about 1.60 m tall, 1.0 m wheels, wheelbase 2.55 m.
    2 doors, rear: trunk lid (Trunk); inline four, small steel tank 30 L.
    14,192 triangles, 20,660 vertices, 31 moving objects, 60 objects in all.
12. Voxel Compact Hatch  (Voxel_Compact_Hatch)
    Four-door compact hatchback in cherry red: spoked rims, hatch with its glass, folding rear bench.
    4.70 m long, about 1.50 m tall, 0.8 m wheels, wheelbase 2.95 m.
    4 doors, rear: hatch with its glass (Hatch); inline four, small steel tank 30 L.
    10,138 triangles, 14,748 vertices, 36 moving objects, 67 objects in all.
13. Voxel Rally Hatch  (Voxel_Rally_Hatch)
    Four-door rally hatchback: blue and white rally livery, roof rack, fender flares, knobby tyres, red calipers, racing fuel cell.
    4.70 m long, about 1.72 m tall, 0.8 m wheels, wheelbase 2.95 m.
    4 doors, rear: hatch with its glass (Hatch); inline four, racing fuel cell 55 L.
    13,630 triangles, 19,998 vertices, 36 moving objects, 67 objects in all.
14. Voxel Luxury Sedan  (Voxel_Luxury_Sedan)
    Four-door luxury sedan: black paint with gold pinstripes, chrome grille and hubcaps, tan leather seats, V8.
    5.30 m long, about 1.50 m tall, 0.8 m wheels, wheelbase 2.95 m.
    4 doors, rear: trunk lid (Trunk); V8, steel tank 45 L.
    8,674 triangles, 12,918 vertices, 36 moving objects, 67 objects in all.
15. Voxel Hot Rod  (Voxel_Hot_Rod)
    Two-door hot rod: black with orange flames, hood scoop, chrome rims, red seats, V8.
    5.30 m long, about 1.50 m tall, 0.8 m wheels, wheelbase 2.95 m.
    2 doors, rear: trunk lid (Trunk); V8, racing fuel cell 55 L.
    9,946 triangles, 14,459 vertices, 31 moving objects, 62 objects in all.
16. Voxel Safari Truck  (Voxel_Safari_Truck)
    Two-door safari truck: sand and olive two-tone, side-hinged tail door with the spare wheel, roof rack, bull bar, knobby tyres.
    4.50 m long, about 1.97 m tall, 1.0 m wheels, wheelbase 2.55 m.
    2 doors, rear: side-hinged tail door with the spare wheel (TailDoor); inline six, big ribbed tank 65 L.
    16,618 triangles, 24,209 vertices, 31 moving objects, 63 objects in all.
17. Voxel Farm Truck  (Voxel_Farm_Truck)
    Two-door farm truck: faded red paint with rust, open bed with a tailgate, steel hubcaps, inline six, rusty tank.
    5.00 m long, about 1.60 m tall, 0.9 m wheels, wheelbase 3.05 m.
    2 doors, rear: tailgate (Tailgate); inline six, old rusty tank 25 L.
    8,102 triangles, 12,112 vertices, 31 moving objects, 62 objects in all.
18. Voxel Lifted Pickup  (Voxel_Lifted_Pickup)
    Two-door lifted pickup in lime green: big knobby wheels, bull bar, fender flares, open bed, V8.
    5.05 m long, about 1.70 m tall, 0.9 m wheels, wheelbase 3.05 m.
    2 doors, rear: tailgate (Tailgate); V8, big ribbed tank 65 L.
    12,806 triangles, 19,119 vertices, 31 moving objects, 62 objects in all.
19. Voxel Delivery Van  (Voxel_Delivery_Van)
    Delivery van: white and blue, no side windows in the cargo area, side-hinged tail door with the spare wheel.
    5.20 m long, about 2.15 m tall, 0.9 m wheels, wheelbase 3.30 m.
    2 doors, rear: side-hinged tail door with the spare wheel (TailDoor); inline four, big ribbed tank 65 L.
    8,988 triangles, 13,383 vertices, 32 moving objects, 64 objects in all.
20. Voxel Ambulance  (Voxel_Ambulance)
    Ambulance: white van with red bands, light bar on the roof (a part of its own), side-hinged tail door with the spare wheel.
    5.20 m long, about 2.27 m tall, 0.9 m wheels, wheelbase 3.30 m.
    2 doors, rear: side-hinged tail door with the spare wheel (TailDoor); inline four, big ribbed tank 65 L.
    9,000 triangles, 13,407 vertices, 32 moving objects, 65 objects in all.
21. Voxel Phantom  (Voxel_Phantom)
    Two-door night coupe: dark navy paint with teal lines, chrome bumpers and rims, no spoiler.
    4.90 m long, about 1.50 m tall, 0.8 m wheels, wheelbase 2.60 m.
    2 doors, rear: trunk lid (Trunk); inline four, racing fuel cell 55 L.
    9,622 triangles, 13,979 vertices, 31 moving objects, 62 objects in all.
22. Voxel Golden Cruiser  (Voxel_Golden_Cruiser)
    Four-door golden cruiser: shiny gold paint (metallic in the texture), cream roof, chrome everywhere, red seats, V8.
    5.30 m long, about 1.50 m tall, 0.8 m wheels, wheelbase 2.95 m.
    4 doors, rear: trunk lid (Trunk); V8, steel tank 45 L.
    8,674 triangles, 12,918 vertices, 36 moving objects, 67 objects in all.
23. Voxel Desert Ranger  (Voxel_Desert_Ranger)
    Two-door desert ranger: lifted pickup in sand and rust rally colours, bull bar, roof rack, big knobby wheels, V8 and a big tank.
    5.05 m long, about 1.82 m tall, 1.0 m wheels, wheelbase 3.05 m.
    2 doors, rear: tailgate (Tailgate); V8, big ribbed tank 65 L.
    15,014 triangles, 21,957 vertices, 31 moving objects, 62 objects in all.
24. Voxel Semi Tractor  (Voxel_Semi_Tractor)
    Semi tractor cab: tall red and white two-tone cab on big chrome wheels, push bar, V8 and a big tank, a short bed behind the cab for your fifth wheel or hitch.
    5.05 m long, about 2.00 m tall, 1.1 m wheels, wheelbase 3.05 m.
    2 doors, rear: tailgate (Tailgate); V8, big ribbed tank 65 L.
    9,178 triangles, 13,706 vertices, 31 moving objects, 62 objects in all.
