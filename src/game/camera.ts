import { PerspectiveCamera } from 'three';
import { CAMERA } from './constants';

export function createCamera(aspect: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(CAMERA.fov, aspect, 0.1, 500);
  camera.position.set(0, 10, 16);
  camera.lookAt(0, 0, 0);
  return camera;
}
