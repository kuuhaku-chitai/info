'use client';

/**
 * Blog3DScene - ブログの3D物理空間
 *
 * 「天井から吊るされた思考の断片」を実現するメインシーン。
 * - Rapierによる微弱重力空間
 * - WindSystemによる常時揺らぎ
 * - WanderingCharacterによる衝突インタラクション
 *
 * これは単なるメニューではなく、
 * 「都市に吊るされた思考の断片」のインスタレーション。
 */

import { Suspense, useState, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';
import { useRouter } from 'next/navigation';

import type { Post } from '@/types';
import { HangingPost } from './HangingPost';
import { WindSystem } from './WindSystem';
import { WanderingCharacter } from './WanderingCharacter';

// 3D空間内のコンテンツ
interface SceneContentProps {
  posts: Post[];
  onPostClick: (post: Post) => void;
}

function SceneContent({ posts, onPostClick }: SceneContentProps) {
  const [windForce, setWindForce] = useState(new THREE.Vector3());

  const handleWindUpdate = useCallback((force: THREE.Vector3) => {
    setWindForce(force.clone());
  }, []);

  return (
    <>
      {/* 環境光: 柔らかく、コントラストを抑えた照明 */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 10, 5]} intensity={0.3} castShadow={false} />

      {/* 風システム: 常に微風が吹いている */}
      <WindSystem onWindUpdate={handleWindUpdate} />

      {/* 物理空間: 微弱重力を設定 */}
      <Physics
        gravity={[0, -0.5, 0]} // 通常の1/20程度の重力
        debug={false}
      >
        {/* 吊るされた記事群 */}
        {posts.map((post, index) => (
          <HangingPost
            key={post.id}
            post={post}
            index={index}
            totalPosts={posts.length}
            onPostClick={onPostClick}
            windForce={windForce}
          />
        ))}

        {/* 徘徊キャラクター: 空間を横切り、記事を揺らす */}
        <WanderingCharacter
          modelPath="/assets/glb/sheep.glb"
          seed={1}
          initialPosition={[-4, -1.5, 0]}
        />
        <WanderingCharacter
          modelPath="/assets/glb/sheep_person.glb"
          seed={42}
          initialPosition={[3, -1.5, 0.5]}
        />
      </Physics>

      {/* 床面: ほぼ見えない参照平面 */}
      <mesh position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20, 10]} />
        <meshBasicMaterial color="#FAFAFA" opacity={0.3} transparent />
      </mesh>

      {/* 天井線: 吊るされている感を強調する微かな線 */}
      <mesh position={[0, 4.2, 0]}>
        <boxGeometry args={[12, 0.01, 0.01]} />
        <meshBasicMaterial color="#1A1A1A" opacity={0.1} transparent />
      </mesh>
    </>
  );
}

// ローディング表示
function LoadingFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="text-ghost text-xs animate-pulse">...</span>
    </div>
  );
}

interface Blog3DSceneProps {
  posts: Post[];
}

export function Blog3DScene({ posts }: Blog3DSceneProps) {
  const router = useRouter();

  const handlePostClick = useCallback(
    (post: Post) => {
      router.push(`/post/${post.id}`);
    },
    [router]
  );

  return (
    <div className="fixed inset-0 w-full h-full">
      <Canvas
        camera={{
          position: [0, 0, 8],
          fov: 50,
          near: 0.1,
          far: 100,
        }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        style={{ background: '#FAFAFA' }}
      >
        <Suspense fallback={null}>
          <SceneContent posts={posts} onPostClick={handlePostClick} />

          {/* カメラコントロール: 微小な操作のみ許可 */}
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            enableRotate={true}
            rotateSpeed={0.2}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 2}
            minAzimuthAngle={-Math.PI / 8}
            maxAzimuthAngle={Math.PI / 8}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
