import { AmbientLight, DirectionalLight, HemisphereLight, Scene } from 'three';

export function addLighting(scene: Scene): void {
  const ambient = new AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const hemi = new HemisphereLight(0xccecff, 0x143019, 1.2);
  scene.add(hemi);

  const sun = new DirectionalLight(0xffffff, 2.6);
  sun.position.set(-10, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  scene.add(sun);
}
