import React, { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Center, ContactShadows, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const MODEL_URL = '/models/fantasy-castle/scene.gltf';

function LoadingCastle() {
  return (
    <mesh position={[2.6, 0.2, 0]}>
      <boxGeometry args={[3.8, 5.5, 3.8]} />
      <meshStandardMaterial color="#d5a640" wireframe emissive="#7a4908" emissiveIntensity={0.8} />
    </mesh>
  );
}

function RealCastle() {
  const castleGroup = useRef();
  const scrollProgress = useRef(0);
  const { scene } = useGLTF(MODEL_URL);
  const castle = useMemo(() => {
    const clonedScene = scene.clone(true);
    clonedScene.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const enhancedMaterials = materials.map((material) => {
        const enhanced = material.clone();
        enhanced.envMapIntensity = 1.3;
        enhanced.roughness = Math.min(enhanced.roughness ?? 0.7, 0.72);
        if (enhanced.color) enhanced.color.lerp(new THREE.Color('#d5a640'), 0.32);
        return enhanced;
      });
      object.material = Array.isArray(object.material) ? enhancedMaterials : enhancedMaterials[0];
    });
    return clonedScene;
  }, [scene]);

  useFrame((state, delta) => {
    const scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const rawProgress = THREE.MathUtils.clamp(window.scrollY / scrollRange, 0, 1);
    const targetProgress = THREE.MathUtils.clamp((rawProgress - 0.025) / 0.975, 0, 1);
    scrollProgress.current = THREE.MathUtils.damp(scrollProgress.current, targetProgress, 4.2, delta);
    const progress = scrollProgress.current;
    const easedProgress = progress * progress * (3 - 2 * progress);

    if (castleGroup.current) {
      castleGroup.current.rotation.y = 3.76 + easedProgress * Math.PI * 2;
      castleGroup.current.rotation.x = 0;
      castleGroup.current.position.x = state.size.width / state.size.height > 1.55 ? 3.15 : 2.1;
    }

    state.camera.position.x = 0;
    state.camera.position.y = THREE.MathUtils.lerp(1.15, -0.45, easedProgress);
    state.camera.position.z = 18;
    state.camera.lookAt(0, THREE.MathUtils.lerp(0.25, -0.15, easedProgress), 0);
  });

  return (
    <group ref={castleGroup} position={[2.35, 0.1, 0]}>
      <Center>
        <primitive object={castle} scale={0.33} />
      </Center>
    </group>
  );
}

useGLTF.preload(MODEL_URL);

export default function Kingdom3D() {
  return (
    <div className="kingdom-canvas" aria-hidden="true">
      <Canvas shadows dpr={[1, 1.6]} camera={{ position: [0, 1.15, 18], fov: 40, near: 0.1, far: 100 }} gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }} onCreated={({ gl }) => { gl.toneMappingExposure = 1.8; }}>
        <fog attach="fog" args={['#080604', 14, 30]} />
        <ambientLight intensity={1.35} color="#d8c6a2" />
        <hemisphereLight args={['#ffd894', '#160d06', 1.6]} />
        <directionalLight position={[6, 11, 7]} intensity={4.6} color="#ffe1a0" castShadow />
        <pointLight position={[-5, 1, 4]} intensity={45} color="#c47b19" distance={14} />
        <pointLight position={[5, 4, -3]} intensity={32} color="#ffc963" distance={13} />
        <Suspense fallback={<LoadingCastle />}>
          <RealCastle />
        </Suspense>
        <ContactShadows position={[0, -2.85, 0]} opacity={0.55} scale={16} blur={2.5} far={7} />
      </Canvas>
    </div>
  );
}
