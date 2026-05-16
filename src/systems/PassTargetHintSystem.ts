import {
  BufferAttribute,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Scene,
  Vector3,
} from 'three';
import type { Ball } from '../entities/Ball';
import { READABILITY } from '../game/constants';

export interface PassHintView {
  visible: boolean;
  targetPosition?: Vector3;
  color: number;
}

export class PassTargetHintSystem {
  private readonly linePositions = new Float32Array(6);
  private readonly lineGeometry = new BufferGeometry();
  private readonly line: Line;
  private readonly marker: Mesh;
  private readonly ballPosition = new Vector3();

  constructor(
    scene: Scene,
    private readonly ball: Ball,
  ) {
    this.lineGeometry.setAttribute('position', new BufferAttribute(this.linePositions, 3));
    this.line = new Line(
      this.lineGeometry,
      new LineBasicMaterial({
        color: 0x7ee2a5,
        transparent: true,
        opacity: READABILITY.passHintOpacity,
      }),
    );
    this.line.visible = false;

    this.marker = new Mesh(
      new RingGeometry(0.42, 0.56, 24),
      new MeshBasicMaterial({
        color: 0x7ee2a5,
        transparent: true,
        opacity: 0.58,
        depthWrite: false,
      }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;

    scene.add(this.line, this.marker);
  }

  update(view: PassHintView): void {
    if (!view.visible || !view.targetPosition) {
      this.hide();
      return;
    }

    this.ball.getPosition(this.ballPosition);
    this.ballPosition.y = READABILITY.passHintHeight;
    const target = view.targetPosition;

    this.linePositions[0] = this.ballPosition.x;
    this.linePositions[1] = READABILITY.passHintHeight;
    this.linePositions[2] = this.ballPosition.z;
    this.linePositions[3] = target.x;
    this.linePositions[4] = READABILITY.passHintHeight;
    this.linePositions[5] = target.z;
    this.lineGeometry.attributes.position.needsUpdate = true;

    const lineMaterial = this.line.material as LineBasicMaterial;
    lineMaterial.color.setHex(view.color);
    lineMaterial.opacity = READABILITY.passHintOpacity;
    const markerMaterial = this.marker.material as MeshBasicMaterial;
    markerMaterial.color.setHex(view.color);

    this.marker.position.set(target.x, READABILITY.passHintHeight + 0.02, target.z);
    this.line.visible = true;
    this.marker.visible = true;
  }

  hide(): void {
    this.line.visible = false;
    this.marker.visible = false;
  }
}
