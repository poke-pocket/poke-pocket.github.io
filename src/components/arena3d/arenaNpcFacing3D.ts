/** Entrance faces the building's local +Z. Return that direction relative to the camera. */
export function entranceFacingRelative(rotY:number,camFwdX:number,camFwdZ:number,camRightX:number,camRightZ:number):[number,number]{
 const x=Math.sin(rotY),z=Math.cos(rotY);
 return [x*camFwdX+z*camFwdZ,x*camRightX+z*camRightZ];
}
