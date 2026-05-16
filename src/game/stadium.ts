import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  RingGeometry,
  TorusGeometry,
} from 'three';
import { PITCH } from './constants';

export function createStadiumEnvironment(): Group {
  const group = new Group();

  const standMaterial = new MeshStandardMaterial({
    color: 0x173222,
    roughness: 0.88,
  });
  const crowdMaterial = new MeshStandardMaterial({
    color: 0x2f6f4a,
    roughness: 0.95,
  });

  const northStand = new Mesh(new BoxGeometry(PITCH.width + 16, 2.2, 4), standMaterial);
  northStand.position.set(0, 1.1, -PITCH.length / 2 - 7);
  group.add(northStand);

  const southStand = northStand.clone();
  southStand.position.z = PITCH.length / 2 + 7;
  group.add(southStand);

  const westStand = new Mesh(new BoxGeometry(4, 2.2, PITCH.length + 12), standMaterial);
  westStand.position.set(-PITCH.width / 2 - 6, 1.1, 0);
  group.add(westStand);

  const eastStand = westStand.clone();
  eastStand.position.x = PITCH.width / 2 + 6;
  group.add(eastStand);

  const crowdRing = new Mesh(
    new RingGeometry(PITCH.width * 0.68, PITCH.width * 0.72, 96),
    crowdMaterial,
  );
  crowdRing.rotation.x = -Math.PI / 2;
  crowdRing.position.y = 2.35;
  crowdRing.scale.z = 1.62;
  group.add(crowdRing);

  const halo = new Mesh(
    new TorusGeometry(PITCH.width * 0.73, 0.05, 8, 128),
    new MeshStandardMaterial({ color: 0x7ee2a5, roughness: 0.6 }),
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 2.7;
  halo.scale.z = 1.62;
  group.add(halo);

  return group;
}
