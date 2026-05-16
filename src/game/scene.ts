import {
  BoxGeometry,
  CircleGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RingGeometry,
  Scene,
  Vector3,
} from 'three';
import { PENALTY_AREA_SIZE, PITCH } from './constants';

export function createScene(): Scene {
  const scene = new Scene();
  scene.background = null;
  return scene;
}

export function createPitch(): Group {
  const group = new Group();

  const grass = new Mesh(
    new PlaneGeometry(PITCH.width, PITCH.length),
    new MeshStandardMaterial({ color: PITCH.grassColor, roughness: 0.92 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  group.add(grass);

  const border = createLineBox(PITCH.width, PITCH.length, PITCH.lineWidth);
  group.add(border);

  const halfway = createLine(PITCH.width, PITCH.lineWidth);
  halfway.position.set(0, 0.014, 0);
  group.add(halfway);

  const centerCircle = new Mesh(
    new RingGeometry(6.2, 6.2 + PITCH.lineWidth, 96),
    new MeshStandardMaterial({ color: PITCH.lineColor, roughness: 0.7 }),
  );
  centerCircle.rotation.x = -Math.PI / 2;
  centerCircle.position.y = 0.018;
  group.add(centerCircle);

  const centerSpot = new Mesh(
    new CircleGeometry(0.14, 24),
    new MeshStandardMaterial({ color: PITCH.lineColor, roughness: 0.7 }),
  );
  centerSpot.rotation.x = -Math.PI / 2;
  centerSpot.position.y = 0.02;
  group.add(centerSpot);

  const boxDepth = PENALTY_AREA_SIZE.depth;
  const boxWidth = PENALTY_AREA_SIZE.width;
  const northBox = createPenaltyBox(boxWidth, boxDepth);
  northBox.position.z = -PITCH.length / 2 + boxDepth / 2;
  group.add(northBox);

  const southBox = createPenaltyBox(boxWidth, boxDepth);
  southBox.position.z = PITCH.length / 2 - boxDepth / 2;
  group.add(southBox);

  return group;
}

function createLineBox(width: number, length: number, thickness: number): Group {
  const group = new Group();
  const halfW = width / 2;
  const halfL = length / 2;

  const top = createLine(width, thickness);
  top.position.set(0, 0.012, -halfL);
  group.add(top);

  const bottom = createLine(width, thickness);
  bottom.position.set(0, 0.012, halfL);
  group.add(bottom);

  const left = createLine(length, thickness);
  left.rotation.y = Math.PI / 2;
  left.position.set(-halfW, 0.012, 0);
  group.add(left);

  const right = createLine(length, thickness);
  right.rotation.y = Math.PI / 2;
  right.position.set(halfW, 0.012, 0);
  group.add(right);

  return group;
}

function createPenaltyBox(width: number, depth: number): Group {
  const group = new Group();
  const back = createLine(width, PITCH.lineWidth);
  back.position.set(0, 0.015, 0);
  group.add(back);

  const left = createLine(depth, PITCH.lineWidth);
  left.rotation.y = Math.PI / 2;
  left.position.set(-width / 2, 0.015, 0);
  group.add(left);

  const right = createLine(depth, PITCH.lineWidth);
  right.rotation.y = Math.PI / 2;
  right.position.set(width / 2, 0.015, 0);
  group.add(right);

  return group;
}

function createLine(length: number, thickness: number): Mesh {
  const mesh = new Mesh(
    new BoxGeometry(length, 0.025, thickness),
    new MeshStandardMaterial({ color: PITCH.lineColor, roughness: 0.7 }),
  );
  mesh.position.copy(new Vector3(0, 0.01, 0));
  return mesh;
}
