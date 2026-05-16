import type { RigidBody, World } from '@dimforge/rapier3d-compat';
import RAPIER from '@dimforge/rapier3d-compat';
import { Player } from '../entities/Player';
import type { Team } from '../entities/Team';
import { KEEPER } from '../game/constants';

export class KeeperBlockSystem {
  private readonly bodies: { player: Player; body: RigidBody }[] = [];

  constructor(
    private readonly world: World,
    teams: Team[],
  ) {
    for (const team of teams) {
      for (const player of team.players) {
        if (player.role !== 'goalkeeper') {
          continue;
        }

        const position = player.group.position;
        const body = this.world.createRigidBody(
          RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
            position.x,
            KEEPER.colliderHalfExtents.y,
            position.z,
          ),
        );
        const collider = RAPIER.ColliderDesc.cuboid(
          KEEPER.colliderHalfExtents.x,
          KEEPER.colliderHalfExtents.y,
          KEEPER.colliderHalfExtents.z,
        )
          .setFriction(1.2)
          .setRestitution(0.18);
        this.world.createCollider(collider, body);
        this.bodies.push({ player, body });
      }
    }
  }

  sync(): void {
    for (const { player, body } of this.bodies) {
      const position = player.group.position;
      body.setNextKinematicTranslation({
        x: position.x,
        y: KEEPER.colliderHalfExtents.y,
        z: position.z,
      });
    }
  }

  dispose(): void {
    for (const { body } of this.bodies) {
      this.world.removeRigidBody(body);
    }
    this.bodies.length = 0;
  }
}
