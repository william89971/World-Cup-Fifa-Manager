import {
  BoxGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
} from 'three';
import { GOAL, PITCH } from '../game/constants';
import { Ball } from './Ball';

export type GoalSide = 'north' | 'south';

export class Goal {
  readonly group: Group;
  readonly side: GoalSide;
  readonly scoringTeam: 'blue' | 'red';

  constructor(side: GoalSide) {
    this.side = side;
    this.scoringTeam = side === 'north' ? 'blue' : 'red';
    this.group = new Group();

    const zSign = side === 'north' ? -1 : 1;
    this.group.position.z = zSign * (PITCH.length / 2);

    const material = new MeshStandardMaterial({
      color: 0xf2f6ef,
      roughness: 0.45,
    });
    const netMaterial = new MeshStandardMaterial({
      color: 0xdfe9e2,
      roughness: 0.7,
      transparent: true,
      opacity: 0.28,
      wireframe: true,
      side: DoubleSide,
    });

    const leftPost = this.createPost(GOAL.postThickness, GOAL.height, GOAL.postThickness, material);
    leftPost.position.set(-GOAL.width / 2, GOAL.height / 2, 0);
    this.group.add(leftPost);

    const rightPost = this.createPost(GOAL.postThickness, GOAL.height, GOAL.postThickness, material);
    rightPost.position.set(GOAL.width / 2, GOAL.height / 2, 0);
    this.group.add(rightPost);

    const crossbar = this.createPost(
      GOAL.width + GOAL.postThickness,
      GOAL.postThickness,
      GOAL.postThickness,
      material,
    );
    crossbar.position.set(0, GOAL.height, 0);
    this.group.add(crossbar);

    const rearBar = this.createPost(
      GOAL.width + GOAL.postThickness,
      GOAL.postThickness,
      GOAL.postThickness,
      material,
    );
    rearBar.position.set(0, GOAL.height, zSign * GOAL.depth);
    this.group.add(rearBar);

    const rearLeftPost = this.createPost(
      GOAL.postThickness,
      GOAL.height,
      GOAL.postThickness,
      material,
    );
    rearLeftPost.position.set(-GOAL.width / 2, GOAL.height / 2, zSign * GOAL.depth);
    this.group.add(rearLeftPost);

    const rearRightPost = this.createPost(
      GOAL.postThickness,
      GOAL.height,
      GOAL.postThickness,
      material,
    );
    rearRightPost.position.set(GOAL.width / 2, GOAL.height / 2, zSign * GOAL.depth);
    this.group.add(rearRightPost);

    const backNet = new Mesh(new PlaneGeometry(GOAL.width, GOAL.height, 8, 5), netMaterial);
    backNet.position.set(0, GOAL.height / 2, zSign * GOAL.depth);
    this.group.add(backNet);

    const sideNetLeft = new Mesh(
      new PlaneGeometry(GOAL.depth, GOAL.height, 4, 5),
      netMaterial,
    );
    sideNetLeft.rotation.y = Math.PI / 2;
    sideNetLeft.position.set(-GOAL.width / 2, GOAL.height / 2, zSign * GOAL.depth / 2);
    this.group.add(sideNetLeft);

    const sideNetRight = sideNetLeft.clone();
    sideNetRight.position.x = GOAL.width / 2;
    this.group.add(sideNetRight);
  }

  containsBall(ball: Ball): boolean {
    const position = ball.getPosition();
    const crossedLine =
      this.side === 'north'
        ? position.z < -PITCH.length / 2
        : position.z > PITCH.length / 2;
    const inMouth = Math.abs(position.x) <= GOAL.width / 2;
    const underBar = position.y >= 0 && position.y <= GOAL.height;
    return crossedLine && inMouth && underBar;
  }

  private createPost(
    width: number,
    height: number,
    depth: number,
    material: MeshStandardMaterial,
  ): Mesh {
    const mesh = new Mesh(new BoxGeometry(width, height, depth), material);
    mesh.castShadow = true;
    return mesh;
  }
}
