/** Shared movement and orbit mathematics for the game and standalone world lab. */
export type SharedCameraMode='hd2d'|'chase'|'free'|'overhead';
export const SHARED_CAMERA_MODES:Record<SharedCameraMode,{label:string;short:string;pitch:number;dist:number;desc:string}>={
 hd2d:{label:'HD-2D斜俯视',short:'HD-2D俯视',pitch:.58,dist:15.2,desc:'经典斜俯视广角，进屋或过桥底时自动平滑推进缩放'},
 chase:{label:'自动追尾跟随',short:'自动追尾',pitch:.34,dist:10.6,desc:'行进时镜头平滑自动回正到角色身后'},
 free:{label:'自由环绕视角',short:'自由环绕',pitch:.28,dist:10.4,desc:'鼠标拖拽或 Z/C 键 360° 自由环绕观察'},
 overhead:{label:'高空全景鸟瞰',short:'高空鸟瞰',pitch:.92,dist:23.5,desc:'街区大视野鸟瞰，进室内或高架下自动推近放大'},
};
export function cameraRelativeMovement(mx:number,mz:number,yaw:number):{x:number;z:number}{const c=Math.cos(yaw),s=Math.sin(yaw);return {x:mx*c+mz*s,z:-mx*s+mz*c}}
export function cameraOrbitPosition(pivot:{x:number;y:number;z:number},yaw:number,pitch:number,distance:number,ceiling=Infinity):{x:number;y:number;z:number}{
 const horizontal=Math.cos(pitch)*distance;return {x:pivot.x+Math.sin(yaw)*horizontal,y:Math.min(pivot.y+Math.sin(pitch)*distance,ceiling),z:pivot.z+Math.cos(yaw)*horizontal};
}
export const GAME_JUMP_VELOCITY=11.2;
export function advanceGroundJump(height:number,velocity:number,dt:number):{height:number;velocity:number}{
 velocity-=23*dt;height+=velocity*dt;
 return height<0?{height:0,velocity:0}:{height,velocity};
}
