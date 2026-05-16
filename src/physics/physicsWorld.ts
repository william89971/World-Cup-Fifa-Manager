import RAPIER, { type World } from '@dimforge/rapier3d-compat';
import { BALL, PHYSICS, PITCH } from '../game/constants';

export interface PhysicsWorld {
  rapier: typeof RAPIER;
  world: World;
}

export async function createPhysicsWorld(): Promise<PhysicsWorld> {
  const initRapier = RAPIER.init as unknown as (options: object) => Promise<void>;
  await initRapier({});

  const world = new RAPIER.World({
    x: PHYSICS.gravity.x,
    y: PHYSICS.gravity.y,
    z: PHYSICS.gravity.z,
  });

  world.integrationParameters.dt = PHYSICS.fixedStep;

  const groundBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.05, 0),
  );
  const groundCollider = RAPIER.ColliderDesc.cuboid(
    PITCH.width / 2,
    0.05,
    PITCH.length / 2,
  )
    .setFriction(BALL.friction)
    .setRestitution(0.05);

  world.createCollider(groundCollider, groundBody);

  return { rapier: RAPIER, world };
}
