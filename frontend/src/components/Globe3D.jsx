import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function latLngToVector3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function GridLines({ radius = 2 }) {
  const geometry = useMemo(() => {
    const geos = [];

    for (let lat = -60; lat <= 60; lat += 30) {
      const points = [];
      for (let lng = 0; lng <= 360; lng += 5) {
        points.push(latLngToVector3(lat, lng, radius));
      }
      geos.push({ points, color: '#7C3AED', opacity: 0.15 });
    }

    for (let lng = 0; lng < 360; lng += 30) {
      const points = [];
      for (let lat = -90; lat <= 90; lat += 5) {
        points.push(latLngToVector3(lat, lng, radius));
      }
      geos.push({ points, color: '#2563EB', opacity: 0.1 });
    }

    return geos;
  }, [radius]);

  return (
    <>
      {geometry.map((g, i) => {
        const geo = new THREE.BufferGeometry().setFromPoints(g.points);
        return (
          <primitive key={i} object={new THREE.Line(geo, new THREE.LineBasicMaterial({ color: g.color, opacity: g.opacity, transparent: true }))} />
        );
      })}
    </>
  );
}

function GlobeWireframe() {
  const groupRef = useRef();

  useFrame((_state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15;
    }
  });

  return (
    <group ref={groupRef} rotation={[0.3, -1.2, 0]}>
      <mesh>
        <sphereGeometry args={[2, 48, 48]} />
        <meshBasicMaterial color="#0a0a1a" opacity={0.9} transparent />
      </mesh>

      <mesh>
        <sphereGeometry args={[2.005, 48, 48]} />
        <meshBasicMaterial color="#7C3AED" opacity={0.08} transparent wireframe />
      </mesh>

      <GridLines />

      <mesh>
        <ringGeometry args={[2.3, 2.32, 64]} />
        <meshBasicMaterial color="#7C3AED" opacity={0.2} transparent side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[Math.PI / 3, 0, 0]}>
        <ringGeometry args={[2.5, 2.52, 64]} />
        <meshBasicMaterial color="#2563EB" opacity={0.12} transparent side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Stars() {
  const positions = useMemo(() => {
    const pos = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return pos;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={600}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.02} transparent opacity={0.6} />
    </points>
  );
}

export default function Globe3D() {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    }}>
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 45 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.3} />
        <Stars />
        <GlobeWireframe />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={false}
          maxPolarAngle={Math.PI}
          minPolarAngle={0}
        />
      </Canvas>
    </div>
  );
}
