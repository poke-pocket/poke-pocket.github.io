/** Shared terrain-following road surface used by geometry and walkable height. */
export const ROAD_GRID = .325;
export const ROAD_SURFACE_LIFT = .145;
export const ROAD_WALK_CLEARANCE = .04;
export interface RoadTerrainGrid {originX:number;originZ:number;stepX:number;stepZ:number}
let activeTerrainGrid:RoadTerrainGrid|undefined;
/** Register the terrain mesh's fixed world grid before constructing roads. */
export function setRoadTerrainGrid(grid:RoadTerrainGrid):()=>void {
 activeTerrainGrid=grid;
 return ()=>{if(activeTerrainGrid===grid)activeTerrainGrid=undefined};
}
/** Same b--c diagonal as Three.js PlaneGeometry, anchored across terrain snaps. */
export function roadTerrainHeight(x:number,z:number,ground:(x:number,z:number)=>number):number {
 const grid=activeTerrainGrid;if(!grid||grid.stepX<=0||grid.stepZ<=0)return ground(x,z);
 const gx=Math.floor((x-grid.originX)/grid.stepX),gz=Math.floor((z-grid.originZ)/grid.stepZ);
 const x0=grid.originX+gx*grid.stepX,z0=grid.originZ+gz*grid.stepZ,u=(x-x0)/grid.stepX,v=(z-z0)/grid.stepZ;
 const a=ground(x0,z0),b=ground(x0+grid.stepX,z0),c=ground(x0,z0+grid.stepZ),d=ground(x0+grid.stepX,z0+grid.stepZ);
 return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
}
export function roadSurfaceVertexY(x:number,z:number,ground:(x:number,z:number)=>number,water:number):number {
 return Math.max(water+.25,roadTerrainHeight(x,z,ground)+ROAD_SURFACE_LIFT);
}
/** Interpolate the same diagonal and vertices as each generated road tile. */
export function roadSurfaceY(x:number,z:number,ground:(x:number,z:number)=>number,water:number):number {
 const gx=Math.floor(x/ROAD_GRID),gz=Math.floor(z/ROAD_GRID),x0=gx*ROAD_GRID,z0=gz*ROAD_GRID;
 const u=(x-x0)/ROAD_GRID,v=(z-z0)/ROAD_GRID;
 const a=roadSurfaceVertexY(x0,z0,ground,water),b=roadSurfaceVertexY(x0+ROAD_GRID,z0,ground,water);
 const c=roadSurfaceVertexY(x0+ROAD_GRID,z0+ROAD_GRID,ground,water),d=roadSurfaceVertexY(x0,z0+ROAD_GRID,ground,water);
 return v<=u ? a+(b-a)*u+(c-b)*v : a+(d-a)*v+(c-d)*u;
}
