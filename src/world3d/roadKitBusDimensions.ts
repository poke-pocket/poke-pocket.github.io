/** Dimensions of the same voxel city bus used by the road-network preview. */
export const CITY_BUS_LENGTH = 24.3735;
export const CITY_BUS_SCALE = CITY_BUS_LENGTH / 12.225;
export const CITY_BUS_WIDTH = 3 * CITY_BUS_SCALE;
export const CITY_BUS_HEIGHT = 3.225 * CITY_BUS_SCALE;

import { makeObbCollider } from './townTypes';
export function createCityBusCollider(x:number,z:number,rotY:number,groundY:number){
 return makeObbCollider(x,z,CITY_BUS_WIDTH*.5,CITY_BUS_LENGTH*.5,rotY,CITY_BUS_HEIGHT,undefined,groundY,groundY+CITY_BUS_HEIGHT);
}
