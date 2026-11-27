import * as THREE from 'three';
import type { CameraFollowMode } from '../types/pet';
import { getWalkableSurfaceHeight3D } from '../data/survivorsTactics';
import { cameraOrbitPosition, SHARED_CAMERA_MODES } from './cameraRigShared3D';
import {
  computeCameraWallClipT,
  isInsideBuildingInterior,
  type EnterableBuildingInterior,
  type ProceduralTownInstance,
} from './townBuilder3D';

export const CAM_MODE_SPECS:Record<CameraFollowMode,{label:string;short:string;pitch:number;dist:number;desc:string}>=SHARED_CAMERA_MODES;

export const CAM_MODE_LIST: CameraFollowMode[] = ['hd2d', 'chase', 'free', 'overhead'];

export interface CameraRigSmoothState {
  dist: number;
  pitch: number;
  clipT: number;
  ceilMaxY: number;
}

export function createCameraRigSmoothState(): CameraRigSmoothState {
  return {
    dist: 15.2,
    pitch: 0.58,
    clipT: 1.0,
    ceilMaxY: 9999,
  };
}

/**
 * Unified Physical 3D Camera Rig Solver:
 * 1. Outdoors: honors user's selected CameraFollowMode (`hd2d` / `chase` / `free` / `overhead`) WITH
 *    smooth 3D Spring-Arm Wall Zoom-In (`缩放放大`, ZERO wall piercing & ZERO transparent neighbor buildings!).
 * 2. Under Elevated Viaducts (`高架桥下`): automatically lowers camera beneath the solid viaduct soffit
 *    and zooms closer so the camera glides under the viaduct with the player instead of getting stuck above it!
 * 3. Inside Walk-In 1F / 2F Rooms: automatically zooms in (`dist ~6.8m, pitch ~0.27`) under the active
 *    floor's ceiling (`1F` ceiling on 1F, `2F` ceiling on 2F!) and stays inside the current room's walls!
 */
export function updatePhysicalCameraRig3D(opts: {
  camera: THREE.PerspectiveCamera;
  pivot: THREE.Vector3;
  orbit: { yaw: number; pitch: number; zoom: number };
  smooth: CameraRigSmoothState;
  mode: CameraFollowMode;
  px: number;
  py: number;
  pz: number;
  worldMx: number;
  worldMz: number;
  mLen: number;
  mzInput: number;
  isDragging: boolean;
  pointerLocked: boolean;
  autoNavActive: boolean;
  occludeTown: ProceduralTownInstance | null;
  activeInterior: EnterableBuildingInterior | null;
  shakeAmp: number;
  dt: number;
}): void {
  const {
    camera,
    pivot,
    orbit,
    smooth,
    mode,
    px,
    py,
    pz,
    worldMx,
    worldMz,
    mLen,
    mzInput,
    isDragging,
    pointerLocked,
    autoNavActive,
    occludeTown,
    activeInterior,
    shakeAmp,
    dt,
  } = opts;

  pivot.lerp(new THREE.Vector3(px, py + 1.52, pz), Math.min(1, dt * 14));

  // Auto-chase yaw behind movement in 'chase' mode
  if (
    mode === 'chase' &&
    mLen > 0.12 &&
    !isDragging &&
    !pointerLocked &&
    (autoNavActive || mzInput <= 0.15)
  ) {
    const desiredYaw = Math.atan2(-worldMx, -worldMz);
    let diffYaw = desiredYaw - orbit.yaw;
    while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
    while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
    orbit.yaw += diffYaw * Math.min(1, dt * (autoNavActive ? 3.8 : 2.6));
  }

  const spec = CAM_MODE_SPECS[mode];
  let wantDist = spec.dist * orbit.zoom;
  let wantPitch = Math.max(-0.16, orbit.pitch);
  let overheadCeilingY = 9999;

  // 1. Check if player is walking underneath an elevated urban viaduct!
  if (occludeTown?.viaductSpans) {
    const viaductBottomWorldY = occludeTown.group.position.y + 7.55;
    if (py < viaductBottomWorldY - 0.6) {
      for (const vs of occludeTown.viaductSpans) {
        const vx = vs.x2 - vs.x1;
        const vz = vs.z2 - vs.z1;
        const vLenSq = vx * vx + vz * vz || 1;
        const tProj = Math.max(0, Math.min(1, ((px - vs.x1) * vx + (pz - vs.z1) * vz) / vLenSq));
        const dSpan = Math.hypot(px - (vs.x1 + vx * tProj), pz - (vs.z1 + vz * tProj));
        if (dSpan < vs.halfWidth + 2.2) {
          overheadCeilingY = Math.min(overheadCeilingY, viaductBottomWorldY - 0.55);
          wantDist = Math.min(wantDist, 8.2 * orbit.zoom);
          wantPitch = Math.min(wantPitch, 0.22);
          break;
        }
      }
    }
  }

  // 2. Check if player is inside a 1F or 2F Walk-In Building Room -> Zoom cleanly inside the room under its ceiling!
  if (activeInterior && isInsideBuildingInterior(px, pz, activeInterior)) {
    const onSecondFloor = activeInterior.stories === 2 && py >= activeInterior.baseY + 3.1;
    const roomCeilY = onSecondFloor ? activeInterior.floor2CeilingY : activeInterior.floor1CeilingY;
    overheadCeilingY = Math.min(overheadCeilingY, roomCeilY - 0.48);
    wantDist = Math.min(wantDist, 6.8 * Math.min(1.15, orbit.zoom));
    wantPitch = Math.min(wantPitch, 0.26);
  }

  // Smoothly damp camera distance, pitch & ceiling clamp so entering doors / viaducts zooms like butter!
  const damp = Math.min(1, dt * 8.5);
  smooth.dist += (wantDist - smooth.dist) * damp;
  smooth.pitch += (wantPitch - smooth.pitch) * damp;
  if (overheadCeilingY < 9000) {
    smooth.ceilMaxY =
      smooth.ceilMaxY > 8000
        ? overheadCeilingY
        : smooth.ceilMaxY + (overheadCeilingY - smooth.ceilMaxY) * Math.min(1, dt * 12);
  } else {
    smooth.ceilMaxY = 9999;
  }

  const yaw = orbit.yaw;
  const pitch = smooth.pitch;
  const baseDist = smooth.dist;
  const rawCamera=cameraOrbitPosition(pivot,yaw,pitch,baseDist,smooth.ceilMaxY);
  const rawCamX=rawCamera.x,rawCamY=rawCamera.y,rawCamZ=rawCamera.z;

  // 3. Universal 3D Wall Spring-Arm Zoom-In across ALL modes (zooms in cleanly before walls — NEVER clips into buildings!)
  const targetClipT = occludeTown
    ? computeCameraWallClipT(
        pivot.x,
        pivot.y,
        pivot.z,
        rawCamX,
        rawCamY,
        rawCamZ,
        occludeTown.group.position.y,
        occludeTown.colliders,
        activeInterior?.id ?? null,
      )
    : 1.0;

  // Pull in fast (dt * 18) when hitting a wall so camera never flashes inside geometry; relax smoothly (dt * 7) when clear!
  const clipSpeed = targetClipT < smooth.clipT ? 18 : 7;
  smooth.clipT += (targetClipT - smooth.clipT) * Math.min(1, dt * clipSpeed);

  const camX = pivot.x + (rawCamX - pivot.x) * smooth.clipT;
  const camZ = pivot.z + (rawCamZ - pivot.z) * smooth.clipT;
  let desiredCamY = pivot.y + (rawCamY - pivot.y) * smooth.clipT;
  if (smooth.ceilMaxY < 9000) {
    desiredCamY = Math.min(desiredCamY, smooth.ceilMaxY);
  }

  const surfaceUnderCam = getWalkableSurfaceHeight3D(camX, camZ, py);
  const sxOff = shakeAmp > 0 ? (Math.random() - 0.5) * shakeAmp : 0;
  const syOff = shakeAmp > 0 ? (Math.random() - 0.5) * shakeAmp : 0;
  const minFloorClearY = surfaceUnderCam + 1.05;
  const finalCamY =
    smooth.ceilMaxY < 9000
      ? Math.min(smooth.ceilMaxY, Math.max(desiredCamY, minFloorClearY))
      : Math.max(desiredCamY, minFloorClearY);

  camera.position.set(camX + sxOff, finalCamY + syOff, camZ);
  // Tilt lookAt upward smoothly when user pitches camera low (`pitch < 0.22`) so towering mountains & skyscrapers frame against the sky!
  const skyGazeLift = Math.max(0, (0.24 - smooth.pitch) * 8.5);
  camera.lookAt(pivot.x, pivot.y + 0.68 + skyGazeLift, pivot.z);
}
