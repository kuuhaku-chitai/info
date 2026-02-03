'use client';

/**
 * Blog3DScene - ブログの3D物理空間
 *
 * 「天井から吊るされた思考の断片」を実現するメインシーン。
 * - Rapierによる微弱重力空間
 * - WindSystemによる常時揺らぎ
 * - WanderingCharacterによる衝突インタラクション
 * - 5個以上の記事がある場合、扉でページネーション
 *
 * これは単なるメニューではなく、
 * 「都市に吊るされた思考の断片」のインスタレーション。
 */

import { Suspense, useState, useCallback, useMemo, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';
import { useRouter } from 'next/navigation';

import type { Post } from '@/types';
import { HangingPost } from './HangingPost';
import { WindSystem } from './WindSystem';
import { WanderingCharacter } from './WanderingCharacter';
import { PaginationDoor } from './PaginationDoor';
import { ZoomController } from './ZoomController';
import { FLOOR_SIZE, FLOOR_Y, CEILING_Y } from './floorConfig';

// ズーム設定
const ZOOM_MIN = 4;
const ZOOM_MAX = 16;
const ZOOM_DEFAULT = 10;

// 記事スケール設定
const POST_SCALE_MIN = 0.5;
const POST_SCALE_MAX = 2.0;
const POST_SCALE_DEFAULT = 0.5;

// 1ページあたりの記事数
const POSTS_PER_PAGE = 5;

// カメラズームを制御するコンポーネント
function CameraController({ zoom }: { zoom: number }) {
  const { camera } = useThree();

  useEffect(() => {
    // カメラのZ位置をズームレベルに合わせて更新
    camera.position.z = zoom;
    camera.updateProjectionMatrix();
  }, [camera, zoom]);

  return null;
}

// 3D空間内のコンテンツ
interface SceneContentProps {
  posts: Post[];
  currentPage: number;
  totalPages: number;
  postScale: number;
  onPostClick: (post: Post) => void;
  onPageChange: (page: number) => void;
}

function SceneContent({
  posts,
  currentPage,
  totalPages,
  postScale,
  onPostClick,
  onPageChange,
}: SceneContentProps): React.JSX.Element {
  const [windForce, setWindForce] = useState(new THREE.Vector3());

  const handleWindUpdate = useCallback((force: THREE.Vector3) => {
    setWindForce(force.clone());
  }, []);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages - 1) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 0) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

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
            scale={postScale}
          />
        ))}

        {/* 徘徊キャラクター: 空間を横切り、記事を揺らす */}
        <WanderingCharacter
          modelPath="/assets/glb/sheep.glb"
          seed={10}
          initialPosition={[-4, 0, 0]}
          size={1.0}
          yOffset={0}
        />
        <WanderingCharacter
          modelPath="/assets/glb/sheep_person.glb"
          seed={42}
          initialPosition={[3, 0, 0.5]}
          size={0.2}
          yOffset={0.5}
        />
      </Physics>

      {/* ページネーション扉: 次のページへ */}
      {currentPage < totalPages - 1 && (
        <PaginationDoor
          direction="next"
          currentPage={currentPage}
          totalPages={totalPages}
          onClick={handleNextPage}
          position={[0, 0, 0]}
        />
      )}

      {/* ページネーション扉: 前のページへ */}
      {currentPage > 0 && (
        <PaginationDoor
          direction="prev"
          currentPage={currentPage}
          totalPages={totalPages}
          onClick={handlePrevPage}
          position={[0, 0, 0]}
        />
      )}

      {/* 床面: ほぼ見えない参照平面 */}
      <mesh position={[0, FLOOR_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[FLOOR_SIZE.width, FLOOR_SIZE.depth]} />
        <meshBasicMaterial color="#FAFAFA" opacity={0.3} transparent />
      </mesh>

      {/* 天井線: 吊るされている感を強調する微かな線 */}
      <mesh position={[0, CEILING_Y + 0.2, 0]}>
        <boxGeometry args={[12, 0.01, 0.01]} />
        <meshBasicMaterial color="#1A1A1A" opacity={0.1} transparent />
      </mesh>
    </>
  );
}

interface Blog3DSceneProps {
  posts: Post[];
}

export function Blog3DScene({ posts }: Blog3DSceneProps) {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [postScale, setPostScale] = useState(POST_SCALE_DEFAULT);

  // ページネーション計算
  const totalPages = useMemo(
    () => Math.ceil(posts.length / POSTS_PER_PAGE),
    [posts.length]
  );

  // 現在のページの記事を取得
  const currentPosts = useMemo(() => {
    const start = currentPage * POSTS_PER_PAGE;
    const end = start + POSTS_PER_PAGE;
    return posts.slice(start, end);
  }, [posts, currentPage]);

  const handlePostClick = useCallback(
    (post: Post) => {
      router.push(`/post/${post.id}`);
    },
    [router]
  );

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const handlePostScaleChange = useCallback((newScale: number) => {
    setPostScale(newScale);
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full">
      <Canvas
        camera={{
          position: [0, 0, zoom],
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
          {/* ズームレベルに応じてカメラ位置を更新 */}
          <CameraController zoom={zoom} />

          <SceneContent
            posts={currentPosts}
            currentPage={currentPage}
            totalPages={totalPages}
            postScale={postScale}
            onPostClick={handlePostClick}
            onPageChange={handlePageChange}
          />

          {/* カメラコントロール: 回転のみ許可、ズームはスライダーから制御 */}
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

      {/* ズームコントローラー: 右端に配置 */}
      <div className="fixed right-[var(--space-lg)] top-1/2 -translate-y-1/2 z-20 flex flex-col gap-4">
        <ZoomController
          zoom={zoom}
          minZoom={ZOOM_MIN}
          maxZoom={ZOOM_MAX}
          onZoomChange={handleZoomChange}
        />

        {/* 記事スケールコントローラー
        <div
          className="flex flex-col items-center gap-2 p-3 bg-[var(--color-void)] border border-[var(--color-edge)] rounded-sm"
          style={{ clipPath: 'polygon(2% 0%, 100% 1%, 98% 100%, 0% 99%)' }}
        >
          <span className="text-[9px] text-ghost tracking-wider">SIZE</span>
          <input
            type="range"
            min={POST_SCALE_MIN}
            max={POST_SCALE_MAX}
            step={0.1}
            value={postScale}
            onChange={(e) => handlePostScaleChange(parseFloat(e.target.value))}
            className="w-12 h-1 appearance-none bg-[var(--color-edge)] rounded cursor-pointer"
            style={{ writingMode: 'horizontal-tb' }}
            aria-label="記事サイズ"
          />
          <span className="text-[9px] text-ghost">{postScale.toFixed(1)}x</span>
        </div>
         */<></>}
      </div>
    </div>
  );
}
