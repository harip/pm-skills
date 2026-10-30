// sandbox/src/screens/HouseAssemblyScreen.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  PanResponder,
  Alert,
  ActionSheetIOS,
  Platform,
  NativeModules,
  Vibration,
  ScrollView,
  Switch,
  Modal,
} from 'react-native';
import Svg, { Polygon, Line, Rect, Circle, Text as SvgText, G, Path } from 'react-native-svg';
import { Room } from '../types/room';
import { GeometryService, ProjectedPoint } from '../services/geometryService';
import { StlExporterService } from '../services/stlExporterService';
import { Database } from '../db/database';

interface Props {
  initialSelectedRoom?: Room;
  onBack: () => void;
}

interface RoomNode {
  room: Room;
  x: number;       // Center X in feet (World Space)
  z: number;       // Center Z in feet (World Space)
  w: number;       // Width in feet
  l: number;       // Length in feet
  h: number;       // Height in feet
  rotation: number;// 0, 90, 180, 270 degrees
  floorLevel: string;
  color: string;
  orthoAngle: number; // Principal axis alignment angle in radians
}

interface SnapGuide {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  anchorX: number;
  anchorZ: number;
  overlapLen: number;
}

interface Face3D {
  points: ProjectedPoint[];
  avgDepth: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity?: number;
  key: string;
}

interface LayersConfig {
  doorsWindows: boolean;
  dimensions: boolean;
  labels: boolean;
  furniture: boolean;
}

export const HouseAssemblyScreen: React.FC<Props> = ({ initialSelectedRoom, onBack }) => {
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [activeTab, setActiveTab] = useState<'studio' | 'dollhouse'>('studio');
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [threeDHeightMode, setThreeDHeightMode] = useState<'4ft' | 'ceil'>('4ft');
  const [showRoomPicker, setShowRoomPicker] = useState(false);
  const [placedRoomNodes, setPlacedRoomNodes] = useState<RoomNode[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [heldRoomId, setHeldRoomId] = useState<string | null>(null); // Active press-and-hold drag room
  const [activeSnapGuide, setActiveSnapGuide] = useState<SnapGuide | null>(null);
  const [mergedPartitions, setMergedPartitions] = useState<Set<string>>(new Set());
  const [isHouseRotateMode, setIsHouseRotateMode] = useState<boolean>(false);

  // Apple Maps-style Layer Toggles: Only Doors & Windows ON by default per user request
  const [layers, setLayers] = useState<LayersConfig>({
    doorsWindows: true,
    dimensions: false,
    labels: false,
    furniture: false,
  });
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Dynamic Viewport Canvas Layout
  const [canvasLayout, setCanvasLayout] = useState({ width: 360, height: 430 });
  const viewW = canvasLayout.width;
  const viewH = canvasLayout.height;

  const viewportRef = useRef<View>(null);
  const viewportLayoutRef = useRef<{ pageX: number; pageY: number; width: number; height: number }>({
    pageX: 16,
    pageY: 164,
    width: 360,
    height: 430,
  });


  // Viewport Zoom, Pan, and 3D Camera Angles
  const [zoom, setZoom] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [angleX, setAngleX] = useState(0.52);
  const [angleY, setAngleY] = useState(-0.35);

  // Touch & Gesture Target Tracking Refs
  const lastTouchPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastPinchDistRef = useRef<number | null>(null);
  const isHeldActiveRef = useRef<boolean>(false);
  const heldRoomIdRef = useRef<string | null>(null);
  const activeGestureTargetRef = useRef<{ type: 'NONE' | 'CANVAS' | 'ROOM'; roomId?: string }>({ type: 'NONE' });
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const unconstrainedPosRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });

  const palette = ['#007aff', '#34c759', '#ff9500', '#af52de', '#5856d6', '#ff2d55'];
  const baseScale2D = 9.0; // 9 pixels per foot

  /**
   * Principal Axis Orthogonalization:
   * Rotates room so primary wall sits 100% square with horizontal/vertical grid.
   */
  const computeOrthoAlignment = (meshJson?: string): number => {
    if (!meshJson) return 0;
    try {
      const parsed = JSON.parse(meshJson);
      const walls: any[] = parsed.walls || [];
      if (walls.length === 0) return 0;

      let longestLen = -1;
      let dominantAngle = 0;

      for (const w of walls) {
        const x1 = w.x1 ?? (w.x !== undefined ? w.x - 2 : 0);
        const z1 = w.z1 ?? (w.z !== undefined ? w.z - 2 : 0);
        const x2 = w.x2 ?? (w.x !== undefined ? w.x + 2 : 0);
        const z2 = w.z2 ?? (w.z !== undefined ? w.z + 2 : 0);
        const dx = x2 - x1;
        const dz = z2 - z1;
        const len = Math.hypot(dx, dz);
        if (len > longestLen && len > 0.5) {
          longestLen = len;
          let angle = Math.atan2(dz, dx);
          while (angle <= -Math.PI / 4) angle += Math.PI / 2;
          while (angle > Math.PI / 4) angle -= Math.PI / 2;
          dominantAngle = angle;
        }
      }
      return -dominantAngle;
    } catch {
      return 0;
    }
  };

  // Load rooms from DB or sample
  useEffect(() => {
    (async () => {
      const userRooms = await Database.getRooms();
      const samples = GeometryService.getSampleRooms();
      const available = userRooms.length > 0 ? userRooms : samples;
      setAllRooms(available);

      const targetRoom = initialSelectedRoom || available[0];
      if (targetRoom) {
        const rw = targetRoom.width_ft || 16;
        const rl = targetRoom.length_ft || 14;
        const rh = targetRoom.height_ft || 9;
        const orthoAngle = computeOrthoAlignment(targetRoom.mesh_json);
        const initialNode: RoomNode = {
          room: targetRoom,
          x: 0,
          z: 0,
          w: rw,
          l: rl,
          h: rh,
          rotation: 0,
          floorLevel: targetRoom.floor_level || 'Ground Floor',
          color: palette[0],
          orthoAngle,
        };
        setPlacedRoomNodes([initialNode]);
        setSelectedRoomId(targetRoom.id);
      }
    })();
  }, [initialSelectedRoom]);

  // Handle Viewport measurement with hardware-accurate measureInWindow
  const handleViewportLayout = (e: any) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setCanvasLayout({ width, height });
      viewportRef.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) {
          viewportLayoutRef.current = { pageX: x, pageY: y, width: w, height: h };
        }
      });
    }
  };

  // Compute 2D coordinate transformation
  const scale2D = useMemo(() => {
    return Math.max(4, baseScale2D * zoom);
  }, [zoom]);

  // Live State Refs: Guarantees PanResponder closures never read stale state
  const placedRoomNodesRef = useRef<RoomNode[]>(placedRoomNodes);
  placedRoomNodesRef.current = placedRoomNodes;

  const scale2DRef = useRef<number>(scale2D);
  scale2DRef.current = scale2D;

  const panOffsetRef = useRef<{ x: number; y: number }>(panOffset);
  panOffsetRef.current = panOffset;

  const selectedRoomIdRef = useRef<string | null>(selectedRoomId);
  selectedRoomIdRef.current = selectedRoomId;

  const viewModeRef = useRef<'2d' | '3d'>(viewMode);
  viewModeRef.current = viewMode;

  const isHouseRotateModeRef = useRef<boolean>(isHouseRotateMode);
  isHouseRotateModeRef.current = isHouseRotateMode;

  const toggleHouseRotateMode = () => {
    triggerHaptic();
    setIsHouseRotateMode((prev) => !prev);
  };

  const canvasLayoutRef = useRef<{ width: number; height: number }>(canvasLayout);
  canvasLayoutRef.current = canvasLayout;

  const worldToCanvasLive = (wx: number, wz: number) => {
    const s = scale2DRef.current;
    const p = panOffsetRef.current;
    const lay = canvasLayoutRef.current;
    return {
      x: lay.width / 2 + wx * s + p.x,
      y: lay.height / 2 + wz * s + p.y,
    };
  };

  const worldToCanvas = (wx: number, wz: number) => {
    return {
      x: viewW / 2 + wx * scale2D + panOffset.x,
      y: viewH / 2 + wz * scale2D + panOffset.y,
    };
  };

  const canvasToWorld = (cx: number, cy: number) => {
    return {
      x: (cx - viewW / 2 - panOffset.x) / scale2D,
      z: (cy - viewH / 2 - panOffset.y) / scale2D,
    };
  };

  // Exact 3D perspective projection matching certified CAD coordinates
  const projectPoint3D = (x_ft: number, z_ft: number, y_elev_ft: number): ProjectedPoint => {
    const xCad = x_ft;
    const yCad = -z_ft;
    const zCad = y_elev_ft;

    const cosY = Math.cos(angleY);
    const sinY = Math.sin(angleY);
    const x1 = xCad * cosY - yCad * sinY;
    const y1 = xCad * sinY + yCad * cosY;

    const sinP = Math.sin(angleX);
    const cosP = Math.cos(angleX);

    const depth = y1 * cosP - zCad * sinP;
    const fovDist = 45.0; // ft perspective distance
    const persp = fovDist / (fovDist + depth);
    const scale = 9.0 * zoom;

    const screenX = viewW / 2 + x1 * scale * persp + panOffset.x;
    const screenY = viewH * 0.52 - (y1 * sinP + zCad * cosP) * scale * persp + panOffset.y;

    return {
      x: screenX,
      y: screenY,
      scale: persp,
      depth: depth,
    };
  };

  // Native Haptics: Disabled per user request
  const triggerHaptic = () => {};
  const triggerMediumHaptic = () => {};

  interface RoomGeometryBounds {
    halfMinX: number;
    halfMaxX: number;
    halfMinZ: number;
    halfMaxZ: number;
    width: number;
    length: number;
  }

  /**
   * Computes exact boundary extent (sub-millimeter) of the room polygon in world space
   * relative to (node.x, node.z), matching exactly how the 2D SVG canvas renders the walls.
   */
  const computeRoomGeometryBounds = (node: RoomNode): RoomGeometryBounds => {
    let parsedMesh: any = null;
    try {
      if (node.room.mesh_json) parsedMesh = JSON.parse(node.room.mesh_json);
    } catch {}

    const realWalls: any[] = parsedMesh?.walls || [];
    const polygon = GeometryService.buildRoomPolygon(realWalls, node.w, node.l);
    const N = polygon.length;
    if (N === 0) {
      const rw = node.rotation % 180 === 0 ? node.w : node.l;
      const rl = node.rotation % 180 === 0 ? node.l : node.w;
      return {
        halfMinX: -rw / 2,
        halfMaxX: rw / 2,
        halfMinZ: -rl / 2,
        halfMaxZ: rl / 2,
        width: rw,
        length: rl,
      };
    }

    const centerPoly = {
      x: polygon.reduce((acc, p) => acc + p.x, 0) / N,
      z: polygon.reduce((acc, p) => acc + p.z, 0) / N,
    };

    const totalRad = (node.rotation * Math.PI) / 180 + node.orthoAngle;
    const cosR = Math.cos(totalRad);
    const sinR = Math.sin(totalRad);

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const p of polygon) {
      const relX = p.x - centerPoly.x;
      const relZ = p.z - centerPoly.z;
      const rotX = relX * cosR - relZ * sinR;
      const rotZ = relX * sinR + relZ * cosR;
      if (rotX < minX) minX = rotX;
      if (rotX > maxX) maxX = rotX;
      if (rotZ < minZ) minZ = rotZ;
      if (rotZ > maxZ) maxZ = rotZ;
    }

    return {
      halfMinX: minX,
      halfMaxX: maxX,
      halfMinZ: minZ,
      halfMaxZ: maxZ,
      width: maxX - minX,
      length: maxZ - minZ,
    };
  };

  /**
   * 4-Sided Collinear Magnetic Snapping Engine:
   * Uses exact polygon wall bounds so adjacent rooms touch with ZERO gap (0.00 offset).
   */
  const applyMagneticSnapping = (
    targetNode: RoomNode,
    nodesList: RoomNode[] = placedRoomNodes
  ): { x: number; z: number; guide: SnapGuide | null } => {
    const tB = computeRoomGeometryBounds(targetNode);

    let bestX = targetNode.x;
    let bestZ = targetNode.z;
    let bestGuide: SnapGuide | null = null;
    let bestScore = 0;

    const tMinX = targetNode.x + tB.halfMinX;
    const tMaxX = targetNode.x + tB.halfMaxX;
    const tMinZ = targetNode.z + tB.halfMinZ;
    const tMaxZ = targetNode.z + tB.halfMaxZ;

    const THRESH_CORNER_FT = 2.5;
    const THRESH_EDGE_FT = 3.0;

    for (const other of nodesList) {
      if (other.room.id === targetNode.room.id) continue;

      const oB = computeRoomGeometryBounds(other);

      const oMinX = other.x + oB.halfMinX;
      const oMaxX = other.x + oB.halfMaxX;
      const oMinZ = other.z + oB.halfMinZ;
      const oMaxZ = other.z + oB.halfMaxZ;

      // 1. Corner Flush Pairs (Snaps rooms flush so walls touch with 0 gap)
      const cornerPairs = [
        // Target West of Other: Target Right Wall touches Other Left Wall (wall at oMinX)
        { snapX: oMinX - tB.halfMaxX, snapZ: oMinZ - tB.halfMinZ, diffX: tMaxX - oMinX, diffZ: tMinZ - oMinZ, axis: 'EW', wallX: oMinX },
        { snapX: oMinX - tB.halfMaxX, snapZ: oMaxZ - tB.halfMaxZ, diffX: tMaxX - oMinX, diffZ: tMaxZ - oMaxZ, axis: 'EW', wallX: oMinX },
        // Target East of Other: Target Left Wall touches Other Right Wall (wall at oMaxX)
        { snapX: oMaxX - tB.halfMinX, snapZ: oMinZ - tB.halfMinZ, diffX: tMinX - oMaxX, diffZ: tMinZ - oMinZ, axis: 'EW', wallX: oMaxX },
        { snapX: oMaxX - tB.halfMinX, snapZ: oMaxZ - tB.halfMaxZ, diffX: tMinX - oMaxX, diffZ: tMaxZ - oMaxZ, axis: 'EW', wallX: oMaxX },
        // Target North of Other: Target Bottom Wall touches Other Top Wall (wall at oMinZ)
        { snapX: oMinX - tB.halfMinX, snapZ: oMinZ - tB.halfMaxZ, diffX: tMinX - oMinX, diffZ: tMaxZ - oMinZ, axis: 'NS', wallZ: oMinZ },
        { snapX: oMaxX - tB.halfMaxX, snapZ: oMinZ - tB.halfMaxZ, diffX: tMaxX - oMaxX, diffZ: tMaxZ - oMinZ, axis: 'NS', wallZ: oMinZ },
        // Target South of Other: Target Top Wall touches Other Bottom Wall (wall at oMaxZ)
        { snapX: oMinX - tB.halfMinX, snapZ: oMaxZ - tB.halfMinZ, diffX: tMinX - oMinX, diffZ: tMinZ - oMaxZ, axis: 'NS', wallZ: oMaxZ },
        { snapX: oMaxX - tB.halfMaxX, snapZ: oMaxZ - tB.halfMinZ, diffX: tMaxX - oMaxX, diffZ: tMinZ - oMaxZ, axis: 'NS', wallZ: oMaxZ },
      ];

      for (const cp of cornerPairs) {
        const dist = Math.hypot(cp.diffX, cp.diffZ);
        if (dist <= THRESH_CORNER_FT && bestScore < 50) {
          bestX = cp.snapX;
          bestZ = cp.snapZ;
          bestScore = 50;

          if (cp.axis === 'EW') {
            const zStart = Math.max(bestZ + tB.halfMinZ, oMinZ);
            const zEnd = Math.min(bestZ + tB.halfMaxZ, oMaxZ);
            bestGuide = {
              x1: cp.wallX ?? cp.snapX,
              z1: zStart,
              x2: cp.wallX ?? cp.snapX,
              z2: zEnd,
              anchorX: cp.wallX ?? cp.snapX,
              anchorZ: (zStart + zEnd) / 2,
              overlapLen: Math.max(0, zEnd - zStart),
            };
          } else {
            const xStart = Math.max(bestX + tB.halfMinX, oMinX);
            const xEnd = Math.min(bestX + tB.halfMaxX, oMaxX);
            bestGuide = {
              x1: xStart,
              z1: cp.wallZ ?? cp.snapZ,
              x2: xEnd,
              z2: cp.wallZ ?? cp.snapZ,
              anchorX: (xStart + xEnd) / 2,
              anchorZ: cp.wallZ ?? cp.snapZ,
              overlapLen: Math.max(0, xEnd - xStart),
            };
          }
        }
      }

      // 2. Collinear Wall Edge Lock (Rooms touch flush along shared wall with 0 gap)
      if (bestScore < 25) {
        // Target West of Other: Target Right Wall touches Other Left Wall (wall at oMinX)
        if (Math.abs(tMaxX - oMinX) <= THRESH_EDGE_FT && Math.abs(tMinZ - oMinZ) < tB.length + oB.length) {
          bestX = oMinX - tB.halfMaxX;
          bestScore = 25;
          const zStart = Math.max(tMinZ, oMinZ);
          const zEnd = Math.min(tMaxZ, oMaxZ);
          bestGuide = {
            x1: oMinX,
            z1: zStart,
            x2: oMinX,
            z2: zEnd,
            anchorX: oMinX,
            anchorZ: (zStart + zEnd) / 2,
            overlapLen: Math.max(0, zEnd - zStart),
          };
        // Target East of Other: Target Left Wall touches Other Right Wall (wall at oMaxX)
        } else if (Math.abs(tMinX - oMaxX) <= THRESH_EDGE_FT && Math.abs(tMinZ - oMinZ) < tB.length + oB.length) {
          bestX = oMaxX - tB.halfMinX;
          bestScore = 25;
          const zStart = Math.max(tMinZ, oMinZ);
          const zEnd = Math.min(tMaxZ, oMaxZ);
          bestGuide = {
            x1: oMaxX,
            z1: zStart,
            x2: oMaxX,
            z2: zEnd,
            anchorX: oMaxX,
            anchorZ: (zStart + zEnd) / 2,
            overlapLen: Math.max(0, zEnd - zStart),
          };
        // Target North of Other: Target Bottom Wall touches Other Top Wall (wall at oMinZ)
        } else if (Math.abs(tMaxZ - oMinZ) <= THRESH_EDGE_FT && Math.abs(tMinX - oMinX) < tB.width + oB.width) {
          bestZ = oMinZ - tB.halfMaxZ;
          bestScore = 25;
          const xStart = Math.max(tMinX, oMinX);
          const xEnd = Math.min(tMaxX, oMaxX);
          bestGuide = {
            x1: xStart,
            z1: oMinZ,
            x2: xEnd,
            z2: oMinZ,
            anchorX: (xStart + xEnd) / 2,
            anchorZ: oMinZ,
            overlapLen: Math.max(0, xEnd - xStart),
          };
        // Target South of Other: Target Top Wall touches Other Bottom Wall (wall at oMaxZ)
        } else if (Math.abs(tMinZ - oMaxZ) <= THRESH_EDGE_FT && Math.abs(tMinX - oMinX) < tB.width + oB.width) {
          bestZ = oMaxZ - tB.halfMinZ;
          bestScore = 25;
          const xStart = Math.max(tMinX, oMinX);
          const xEnd = Math.min(tMaxX, oMaxX);
          bestGuide = {
            x1: xStart,
            z1: oMaxZ,
            x2: xEnd,
            z2: oMaxZ,
            anchorX: (xStart + xEnd) / 2,
            anchorZ: oMaxZ,
            overlapLen: Math.max(0, xEnd - xStart),
          };
        }
      }
    }

    if (bestScore > 0 && (!activeSnapGuide || activeSnapGuide.anchorX !== bestGuide?.anchorX)) {
      triggerHaptic();
    }

    return { x: bestX, z: bestZ, guide: bestGuide };
  };

  // Canvas PanResponder: Unambiguous Touch Differentiation
  // - Touch on background canvas: Drag moves all rooms as a whole (Canvas Pan Mode)
  // - Touch on a room: Press & hold moves ONLY that room with Light Orange Border & Real-Time Magnetic Snapping
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;

        if (touches.length >= 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          lastPinchDistRef.current = Math.hypot(dx, dy);
          lastTouchPosRef.current = null;
          activeGestureTargetRef.current = { type: 'NONE' };
          isHeldActiveRef.current = false;
          heldRoomIdRef.current = null;
          setHeldRoomId(null);
        } else if (touches.length === 1) {
          const pageX = evt.nativeEvent.pageX;
          const pageY = evt.nativeEvent.pageY;
          lastTouchPosRef.current = { x: pageX, y: pageY };
          touchStartPosRef.current = { x: pageX, y: pageY };
          lastPinchDistRef.current = null;

          if (viewMode === '2d') {
            const touch = evt.nativeEvent.touches?.[0] || evt.nativeEvent.changedTouches?.[0] || evt.nativeEvent;
            const vp = viewportLayoutRef.current;
            // Robust coordinate calculation across all iOS devices and layouts:
            let canvasX = (touch.locationX !== undefined && Math.abs(touch.locationX - touch.pageX) > 5)
              ? touch.locationX
              : touch.pageX - vp.pageX;
            let canvasY = (touch.locationY !== undefined && Math.abs(touch.locationY - touch.pageY) > 5)
              ? touch.locationY
              : touch.pageY - vp.pageY;

            const liveRooms = placedRoomNodesRef.current;
            const liveSelId = selectedRoomIdRef.current;
            const liveScale = scale2DRef.current;

            // 1. Direct hit-test for corner rotation handle on currently selected room
            if (liveSelId) {
              const selNode = liveRooms.find((n) => n.room.id === liveSelId);
              if (selNode) {
                const cc = worldToCanvasLive(selNode.x, selNode.z);
                const b = computeRoomGeometryBounds(selNode);
                const handleX = cc.x + b.halfMaxX * liveScale - 14;
                const handleY = cc.y + b.halfMinZ * liveScale + 14;
                const distToHandle = Math.hypot(canvasX - handleX, canvasY - handleY);
                if (distToHandle <= 36) {
                  activeGestureTargetRef.current = { type: 'NONE' };
                  handleRotateSelectedRoom();
                  return;
                }
              }
            }

            // 2. Pixel-accurate hit test across placed rooms (Closest room center wins)
            let hitRoomId: string | null = null;
            let bestCenterDist = Infinity;
            const pad = 28; // 28px comfortable finger touch slop

            for (let i = 0; i < liveRooms.length; i++) {
              const n = liveRooms[i];
              const b = computeRoomGeometryBounds(n);
              const rwPx = b.width * liveScale;
              const rlPx = b.length * liveScale;
              const center = worldToCanvasLive(n.x, n.z);
              if (
                canvasX >= center.x - rwPx / 2 - pad &&
                canvasX <= center.x + rwPx / 2 + pad &&
                canvasY >= center.y - rlPx / 2 - pad &&
                canvasY <= center.y + rlPx / 2 + pad
              ) {
                const dist = Math.hypot(canvasX - center.x, canvasY - center.y);
                if (dist < bestCenterDist) {
                  bestCenterDist = dist;
                  hitRoomId = n.room.id;
                }
              }
            }

            if (hitRoomId) {
              const hitNode = liveRooms.find((n) => n.room.id === hitRoomId);
              // Touch is ON A ROOM: Lock into ROOM DRAG MODE (Light Orange Border #f97316)
              activeGestureTargetRef.current = { type: 'ROOM', roomId: hitRoomId };
              setSelectedRoomId(hitRoomId);
              setHeldRoomId(hitRoomId);
              isHeldActiveRef.current = true;
              heldRoomIdRef.current = hitRoomId;
              if (hitNode) {
                unconstrainedPosRef.current = { x: hitNode.x, z: hitNode.z };
              }
            } else {
              // Touch is OUTSIDE ALL ROOMS: Lock into CANVAS PAN MODE (Move all rooms as a whole)
              activeGestureTargetRef.current = { type: 'CANVAS' };
              isHeldActiveRef.current = false;
              heldRoomIdRef.current = null;
              setHeldRoomId(null);
            }
          }
        }
      },
      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const curDist = Math.hypot(dx, dy);
          if (lastPinchDistRef.current !== null && lastPinchDistRef.current > 0) {
            const delta = (curDist - lastPinchDistRef.current) * 0.005;
            setZoom((prev) => Math.max(0.4, Math.min(2.8, +(prev + delta).toFixed(3))));
          }
          lastPinchDistRef.current = curDist;
        } else if (touches.length === 1) {
          const curX = evt.nativeEvent.pageX;
          const curY = evt.nativeEvent.pageY;

          if (lastTouchPosRef.current) {
            const dx = curX - lastTouchPosRef.current.x;
            const dy = curY - lastTouchPosRef.current.y;

            if (viewMode === '3d') {
              if (isHouseRotateModeRef.current) {
                // ROTATE 3D HOUSE (ALL DIRECTIONS - Silky Smooth Studio Rotation Formula):
                setAngleY((prev) => prev + dx * 0.008);
                setAngleX((prev) => Math.max(0.15, Math.min(1.45, prev - dy * 0.008)));
              } else {
                // PAN / TRANSLATE VIEW (When Rotate toggle is OFF, finger freely moves the house):
                setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
              }
            } else if (activeGestureTargetRef.current.type === 'ROOM' && heldRoomIdRef.current) {
              // DRAG ONLY THE HELD ROOM (All other rooms stay fixed)
              const curScale = scale2DRef.current;
              const dWorldX = dx / curScale;
              const dWorldZ = dy / curScale;
              unconstrainedPosRef.current.x += dWorldX;
              unconstrainedPosRef.current.z += dWorldZ;

              setPlacedRoomNodes((prev) =>
                prev.map((n) => {
                  if (n.room.id === heldRoomIdRef.current) {
                    const rawNode = {
                      ...n,
                      x: unconstrainedPosRef.current.x,
                      z: unconstrainedPosRef.current.z,
                    };
                    // Continuous Real-Time Magnetic Snapping against all other rooms
                    const snapped = applyMagneticSnapping(rawNode, prev);
                    setActiveSnapGuide(snapped.guide);
                    if (snapped.guide && snapped.guide.overlapLen > 0) {
                      const snapKey = `${snapped.guide.x1.toFixed(1)}_${snapped.guide.z1.toFixed(1)}_${snapped.guide.x2.toFixed(1)}_${snapped.guide.z2.toFixed(1)}`;
                      setMergedPartitions((prevPartitions) =>
                        prevPartitions.has(snapKey) ? prevPartitions : new Set(prevPartitions).add(snapKey)
                      );
                    }
                    return {
                      ...n,
                      x: snapped.x,
                      z: snapped.z,
                    };
                  }
                  return n;
                })
              );
            } else if (activeGestureTargetRef.current.type === 'CANVAS') {
              // DRAG CANVAS BACKGROUND: Moves all rooms as a whole
              setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
            }
          }
          lastTouchPosRef.current = { x: curX, y: curY };
        }
      },
      onPanResponderRelease: () => {
        if (activeGestureTargetRef.current.type === 'ROOM' && isHeldActiveRef.current) {
          triggerHaptic();
        }
        if (activeSnapGuide && activeSnapGuide.overlapLen > 0) {
          const snapKey = `${activeSnapGuide.x1.toFixed(1)}_${activeSnapGuide.z1.toFixed(1)}_${activeSnapGuide.x2.toFixed(1)}_${activeSnapGuide.z2.toFixed(1)}`;
          setMergedPartitions((prevPartitions) =>
            prevPartitions.has(snapKey) ? prevPartitions : new Set(prevPartitions).add(snapKey)
          );
        }
        activeGestureTargetRef.current = { type: 'NONE' };
        isHeldActiveRef.current = false;
        heldRoomIdRef.current = null;
        setHeldRoomId(null); // Return light orange border back to blue selection
        lastTouchPosRef.current = null;
        touchStartPosRef.current = null;
        lastPinchDistRef.current = null;
      },
    })
  ).current;

  // Rotate Selected Room (0° -> 90° -> 180° -> 270°)
  const handleRotateSelectedRoom = () => {
    if (!selectedRoomId) return;
    setPlacedRoomNodes((prev) =>
      prev.map((n) => {
        if (n.room.id === selectedRoomId) {
          const nextRot = (n.rotation + 90) % 360;
          const rotatedNode = { ...n, rotation: nextRot };
          const snapped = applyMagneticSnapping(rotatedNode, prev);
          setActiveSnapGuide(snapped.guide);
          return {
            ...rotatedNode,
            x: snapped.x,
            z: snapped.z,
          };
        }
        return n;
      })
    );
    triggerHaptic();
  };

  // Remove Selected Room from Canvas
  const handleRemoveSelectedRoom = () => {
    if (!selectedRoomId) return;
    const remId = selectedRoomId;
    const remaining = placedRoomNodes.filter((n) => n.room.id !== remId);
    setPlacedRoomNodes(remaining);
    setSelectedRoomId(remaining.length > 0 ? remaining[0].room.id : null);
    setActiveSnapGuide(null);
    triggerHaptic();
  };

  // Add Room to Canvas
  const handleAddRoomToCanvas = (room: Room) => {
    if (placedRoomNodes.some((n) => n.room.id === room.id)) {
      setSelectedRoomId(room.id);
      return;
    }

    let maxRightEdge = 0;
    placedRoomNodes.forEach((n) => {
      const b = computeRoomGeometryBounds(n);
      maxRightEdge = Math.max(maxRightEdge, n.x + b.halfMaxX);
    });

    const rw = room.width_ft || 16;
    const rl = room.length_ft || 14;
    const rh = room.height_ft || 9;
    const orthoAngle = computeOrthoAlignment(room.mesh_json);

    const tmpNode: RoomNode = {
      room,
      x: 0,
      z: 0,
      w: rw,
      l: rl,
      h: rh,
      rotation: 0,
      floorLevel: room.floor_level || 'Ground Floor',
      color: palette[placedRoomNodes.length % palette.length],
      orthoAngle,
    };
    const newB = computeRoomGeometryBounds(tmpNode);

    const newNode: RoomNode = {
      ...tmpNode,
      x: placedRoomNodes.length === 0 ? 0 : maxRightEdge + 3.0 - newB.halfMinX,
    };

    setPlacedRoomNodes((prev) => [...prev, newNode]);
    setSelectedRoomId(room.id);
    if (placedRoomNodes.length >= 1) {
      setZoom((prev) => Math.min(prev, 0.78)); // Comfortable fit for multi-room canvas
    }
    triggerHaptic();
  };

  // Export Composite STL
  const doExportCompositeStl = async (withRoof: boolean, includeFurniture: boolean) => {
    if (placedRoomNodes.length === 0) {
      Alert.alert('Studio Empty', 'Please place at least one room on the canvas before exporting.');
      return;
    }
    const stl = StlExporterService.generatePlacedCompositeStl(placedRoomNodes, {
      withRoof,
      includeFurniture,
      heightMode: threeDHeightMode,
    });
    const suffix = withRoof
      ? '_Whole_House_With_Roof.stl'
      : includeFurniture
      ? '_Whole_House_Open_Top_Furnished.stl'
      : '_Whole_House_Shell_Empty.stl';
    const safeName = 'Whole_House_Model' + suffix;

    if (Platform.OS === 'ios' && NativeModules?.RoomPlanModule?.exportAndShareStl) {
      try {
        await NativeModules.RoomPlanModule.exportAndShareStl(safeName, stl);
        return;
      } catch (e) {
        console.warn('Native export share failed:', e);
      }
    }

    Alert.alert(
      'Export Whole-House 3D (.STL)',
      `Generated certified 2-manifold whole house solid model (${stl.length} bytes).\nFormat: ${
        withRoof
          ? 'Enclosed with Solid Roof'
          : includeFurniture
          ? 'Architectural Dollhouse (Open Top + Grounded Furniture)'
          : 'Clean House Shell'
      }.\nUniversal 80.0" Header Datum • Watertight Cutouts.`
    );
  };

  const handleExportSheet = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Export Whole House 3D (.STL)',
          message: 'Certified 2-Manifold CAD Architecture (No Empty Layers):',
          options: [
            'Cancel',
            '📐 Architectural Dollhouse (Open Top + Grounded Furniture)',
            '🏠 Enclosed House (With Solid Roof)',
            '🏛️ Clean House Shell (Empty - Walls & Floor Only)',
          ],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) doExportCompositeStl(false, true);
          else if (buttonIndex === 2) doExportCompositeStl(true, true);
          else if (buttonIndex === 3) doExportCompositeStl(false, false);
        }
      );
    } else {
      doExportCompositeStl(false, true);
    }
  };

  const handleExportPdf = () => {
    if (placedRoomNodes.length === 0) {
      Alert.alert('Studio Empty', 'Please place at least one room on the canvas before exporting PDF.');
      return;
    }
    const summary = placedRoomNodes
      .map(
        (n, i) =>
          `• Room ${i + 1}: ${n.room.name}\n  Dimensions: ${Math.round(
            n.rotation % 180 === 0 ? n.w : n.l
          )}' × ${Math.round(n.rotation % 180 === 0 ? n.l : n.w)}' (${Math.round(
            n.w * n.l
          )} sq ft) • ${n.floorLevel || 'Ground Floor'}`
      )
      .join('\n\n');

    Alert.alert(
      'Export Floor Plan (PDF)',
      `Certified Architectural 2D Plan View Document\n\nTotal Rooms: ${placedRoomNodes.length}\nTotal Footprint: ${Math.round(
        totalArea
      )} sq ft\n\n${summary}\n\nUniversal 1/4" = 1'-0" Scale • Certified Dimensional Datum.`,
      [{ text: 'Done', style: 'default' }]
    );
  };

  const selectedNode = placedRoomNodes.find((n) => n.room.id === selectedRoomId);
  const totalArea = useMemo(() => {
    return placedRoomNodes.reduce((acc, n) => acc + n.w * n.l, 0);
  }, [placedRoomNodes]);

  // =========================================================================
  // CERTIFIED CAD GEOMETRY ENGINE: Full 3D Solid Model Reconstruction
  // =========================================================================
  const { allFaces3D, allCanopies } = useMemo(() => {
    const faces: Face3D[] = [];
    const canopies: { points: ProjectedPoint[]; key: string }[] = [];
    const lx = 0.35, lz = 0.55;

    // Composite centroid of whole house so 3D rotation orbits perfectly in place
    const houseCentroid = {
      x: placedRoomNodes.length > 0 ? placedRoomNodes.reduce((acc, n) => acc + n.x, 0) / placedRoomNodes.length : 0,
      z: placedRoomNodes.length > 0 ? placedRoomNodes.reduce((acc, n) => acc + n.z, 0) / placedRoomNodes.length : 0,
    };

    for (const node of placedRoomNodes) {
      const room = node.room;
      let parsedMesh: any = null;
      try {
        if (room.mesh_json) parsedMesh = JSON.parse(room.mesh_json);
      } catch {
        parsedMesh = null;
      }

      const realWalls: any[] = parsedMesh?.walls || [];
      const realDoors: any[] = parsedMesh?.doors || [];
      const realWindows: any[] = parsedMesh?.windows || [];
      const realObjects: any[] = parsedMesh?.objects || [];

      const polygon = GeometryService.buildRoomPolygon(realWalls, node.w, node.l);
      const N = polygon.length;

      const centerPoly = {
        x: polygon.reduce((acc, p) => acc + p.x, 0) / N,
        z: polygon.reduce((acc, p) => acc + p.z, 0) / N,
      };

      const totalRad = (node.rotation * Math.PI) / 180 + node.orthoAngle;
      const cosR = Math.cos(totalRad);
      const sinR = Math.sin(totalRad);

      const localToWorldCAD = (vxM: number, vyM: number, vzM: number) => {
        const lxFt = vxM / 0.3048 - centerPoly.x;
        const lzFt = vzM / 0.3048 - centerPoly.z;
        const lyFt = vyM / 0.3048;

        const rotX = lxFt * cosR - lzFt * sinR;
        const rotZ = lxFt * sinR + lzFt * cosR;

        const wx = (node.x - houseCentroid.x) + rotX;
        const wz = (node.z - houseCentroid.z) + rotZ;
        const wy = lyFt;

        return { wx, wz, wy };
      };

      const projectCADVertex = (vxM: number, vyM: number, vzM: number): ProjectedPoint => {
        const { wx, wz, wy } = localToWorldCAD(vxM, vyM, vzM);
        return projectPoint3D(wx, wz, wy);
      };

      // 1. Watertight Solid Floor Polygon
      const floorProjected = polygon.map((p) =>
        projectCADVertex(p.x * 0.3048, 0, p.z * 0.3048)
      );
      const floorAvgDepth = floorProjected.reduce((acc, p) => acc + p.depth, 0) / N;
      faces.push({
        points: floorProjected,
        avgDepth: floorAvgDepth,
        fill: '#f8fafc',
        stroke: '#cbd5e1',
        strokeWidth: 1.5,
        key: `solid-floor-${node.room.id}`,
      });

      // 2. Parametric Watertight Wall Sub-Prisms with Real Cutouts
      const wallSegmentsM: { p1: { x: number; z: number }; p2: { x: number; z: number } }[] = [];
      for (let i = 0; i < N; i++) {
        const cur = polygon[i];
        const nxt = polygon[(i + 1) % N];
        wallSegmentsM.push({
          p1: { x: cur.x * 0.3048, z: cur.z * 0.3048 },
          p2: { x: nxt.x * 0.3048, z: nxt.z * 0.3048 },
        });
      }

      const isKitchen = /kitchen|dining/i.test(room.name || '');
      const defaultSillM = isKitchen
        ? GeometryService.KITCHEN_WINDOW_SILL_M
        : GeometryService.BEDROOM_WINDOW_SILL_M;

      const apertureMap = GeometryService.projectAperturesOntoWalls(
        wallSegmentsM,
        realDoors,
        realWindows,
        defaultSillM
      );

      const fullCeilingM = (room.height_ft || 8.5) * 0.3048;
      const effectiveHeightM = threeDHeightMode === 'ceil' ? fullCeilingM : Math.min(1.2192, fullCeilingM);
      const wallThickM = GeometryService.EXTERIOR_WALL_THICKNESS_M;

      for (let i = 0; i < N; i++) {
        const w = wallSegmentsM[i];
        const dx = w.p2.x - w.p1.x;
        const dz = w.p2.z - w.p1.z;
        const len = Math.hypot(dx, dz) || 1.0;

        let nx = -dz / len;
        let nz = dx / len;
        const midX = (w.p1.x + w.p2.x) / 2;
        const midZ = (w.p1.z + w.p2.z) / 2;
        if (nx * (midX - centerPoly.x * 0.3048) + nz * (midZ - centerPoly.z * 0.3048) < 0) {
          nx = -nx;
          nz = -nz;
        }

        const rnx = nx * cosR - nz * sinR;
        const rnz = nx * sinR + nz * cosR;
        const dot = rnx * lx + rnz * lz;
        const intensity = Math.max(0.4, Math.min(1.0, 0.65 + 0.35 * dot));
        const rVal = Math.round(230 * intensity + 20);
        const gVal = Math.round(235 * intensity + 15);
        const bVal = Math.round(245 * intensity);
        const extWallColor = `rgb(${rVal}, ${gVal}, ${bVal})`;
        const intWallColor = `rgb(${Math.round(rVal * 0.92)}, ${Math.round(gVal * 0.92)}, ${Math.round(bVal * 0.95)})`;
        const jambColor = `rgb(${Math.round(rVal * 0.85)}, ${Math.round(gVal * 0.85)}, ${Math.round(bVal * 0.88)})`;

        const rawApertures = apertureMap.get(i) || [];
        const apertures = rawApertures.map((a) => ({
          ...a,
          yBottom: Math.min(effectiveHeightM, a.yBottom),
          yTop: Math.min(effectiveHeightM, a.yTop),
        }));

        const subPrisms = GeometryService.subdivideWallWithOpenings(
          w.p1,
          w.p2,
          wallThickM,
          effectiveHeightM,
          { x: nx, z: nz },
          apertures
        );

        subPrisms.forEach((prism, pIdx) => {
          const { v0, v1, v2, v3, v4, v5, v6, v7 } = prism.vertices;
          const p0 = projectCADVertex(v0.x, v0.y, v0.z);
          const p1 = projectCADVertex(v1.x, v1.y, v1.z);
          const p2 = projectCADVertex(v2.x, v2.y, v2.z);
          const p3 = projectCADVertex(v3.x, v3.y, v3.z);
          const p4 = projectCADVertex(v4.x, v4.y, v4.z);
          const p5 = projectCADVertex(v5.x, v5.y, v5.z);
          const p6 = projectCADVertex(v6.x, v6.y, v6.z);
          const p7 = projectCADVertex(v7.x, v7.y, v7.z);

          // Exterior face
          faces.push({
            points: [p0, p1, p5, p4],
            avgDepth: (p0.depth + p1.depth + p5.depth + p4.depth) / 4,
            fill: extWallColor,
            stroke: '#94a3b8',
            strokeWidth: 1.0,
            key: `wall-${node.room.id}-${i}-${pIdx}-ext`,
          });

          // Interior face
          faces.push({
            points: [p2, p3, p7, p6],
            avgDepth: (p2.depth + p3.depth + p7.depth + p6.depth) / 4,
            fill: intWallColor,
            stroke: '#94a3b8',
            strokeWidth: 1.0,
            key: `wall-${node.room.id}-${i}-${pIdx}-int`,
          });

          // Jamb 1
          faces.push({
            points: [p3, p0, p4, p7],
            avgDepth: (p3.depth + p0.depth + p4.depth + p7.depth) / 4,
            fill: jambColor,
            stroke: '#64748b',
            strokeWidth: 1.0,
            key: `wall-${node.room.id}-${i}-${pIdx}-j1`,
          });

          // Jamb 2
          faces.push({
            points: [p1, p2, p6, p5],
            avgDepth: (p1.depth + p2.depth + p6.depth + p5.depth) / 4,
            fill: jambColor,
            stroke: '#64748b',
            strokeWidth: 1.0,
            key: `wall-${node.room.id}-${i}-${pIdx}-j2`,
          });

          // Top cap (poche)
          const isSel = node.room.id === selectedRoomId;
          faces.push({
            points: [p4, p5, p6, p7],
            avgDepth: (p4.depth + p5.depth + p6.depth + p7.depth) / 4,
            fill: isSel ? '#1c1c1e' : '#2c2c2e',
            stroke: isSel ? '#007aff' : '#1e293b',
            strokeWidth: isSel ? 1.5 : 1.0,
            key: `wall-${node.room.id}-${i}-${pIdx}-top`,
          });
        });

        // Window glass
        const ux = dx / len;
        const uz = dz / len;
        for (const a of rawApertures) {
          if (a.type === 'window' && a.yBottom < effectiveHeightM) {
            const glassTopM = Math.min(effectiveHeightM, a.yTop);
            const glassSillM = a.yBottom;
            const g0 = projectCADVertex(w.p1.x + a.startDist * ux, glassSillM, w.p1.z + a.startDist * uz);
            const g1 = projectCADVertex(w.p1.x + a.endDist * ux, glassSillM, w.p1.z + a.endDist * uz);
            const g2 = projectCADVertex(w.p1.x + a.endDist * ux, glassTopM, w.p1.z + a.endDist * uz);
            const g3 = projectCADVertex(w.p1.x + a.startDist * ux, glassTopM, w.p1.z + a.startDist * uz);

            faces.push({
              points: [g0, g1, g2, g3],
              avgDepth: (g0.depth + g1.depth + g2.depth + g3.depth) / 4,
              fill: 'rgba(56, 189, 248, 0.45)',
              stroke: '#0284c7',
              strokeWidth: 1.2,
              key: `win-glass-${node.room.id}-${i}-${a.startDist.toFixed(2)}`,
            });
          }
        }
      }

      // 3. True 3D Solid Objects / Furniture (Bed, Sofa, Table, Storage)
      if (layers.furniture) {
        realObjects.forEach((obj, oIdx) => {
          const objXM = (obj.x ?? 0) * 0.3048;
          const objZM = (obj.z ?? 0) * 0.3048;
          const halfWM = ((obj.widthFt || 3) * 0.3048) / 2;
          const halfLM = ((obj.lengthFt || 3) * 0.3048) / 2;
          const objHeightM = (obj.heightFt || 2.5) * 0.3048;

          let ux = 1, uz = 0;
          let vx = 0, vz = 1;

          if (obj.dirXx !== undefined && obj.dirXz !== undefined) {
            const lenX = Math.hypot(obj.dirXx, obj.dirXz) || 1;
            ux = obj.dirXx / lenX;
            uz = obj.dirXz / lenX;
            if (obj.dirZx !== undefined && obj.dirZz !== undefined) {
              const lenZ = Math.hypot(obj.dirZx, obj.dirZz) || 1;
              vx = obj.dirZx / lenZ;
              vz = obj.dirZz / lenZ;
            } else {
              vx = -uz;
              vz = ux;
            }
          } else if (obj.yawDeg !== undefined) {
            const r = (obj.yawDeg * Math.PI) / 180;
            ux = Math.cos(r);
            uz = Math.sin(r);
            vx = -uz;
            vz = ux;
          }

          const c0 = { x: -halfWM * ux - halfLM * vx, z: -halfWM * uz - halfLM * vz };
          const c1 = { x:  halfWM * ux - halfLM * vx, z:  halfWM * uz - halfLM * vz };
          const c2 = { x:  halfWM * ux + halfLM * vx, z:  halfWM * uz + halfLM * vz };
          const c3 = { x: -halfWM * ux + halfLM * vx, z: -halfWM * uz + halfLM * vz };

          const pb0 = projectCADVertex(objXM + c0.x, 0, objZM + c0.z);
          const pb1 = projectCADVertex(objXM + c1.x, 0, objZM + c1.z);
          const pb2 = projectCADVertex(objXM + c2.x, 0, objZM + c2.z);
          const pb3 = projectCADVertex(objXM + c3.x, 0, objZM + c3.z);

          const pt0 = projectCADVertex(objXM + c0.x, objHeightM, objZM + c0.z);
          const pt1 = projectCADVertex(objXM + c1.x, objHeightM, objZM + c1.z);
          const pt2 = projectCADVertex(objXM + c2.x, objHeightM, objZM + c2.z);
          const pt3 = projectCADVertex(objXM + c3.x, objHeightM, objZM + c3.z);

          const catLower = (obj.category || '').toLowerCase();
          const isBed = catLower.includes('bed');
          const isStorage = catLower.includes('storage') || catLower.includes('cabinet') || catLower.includes('tv');
          const isChair = catLower.includes('chair') || catLower.includes('sofa');
          const baseR = isBed ? 200 : isStorage ? 190 : isChair ? 165 : 180;
          const baseG = isBed ? 190 : isStorage ? 205 : isChair ? 180 : 195;
          const baseB = isBed ? 230 : isStorage ? 240 : isChair ? 220 : 225;
          const strokeCol = isBed ? '#8b5cf6' : isStorage ? '#3b82f6' : isChair ? '#6366f1' : '#64748b';

          faces.push({
            points: [pt0, pt1, pt2, pt3],
            avgDepth: (pt0.depth + pt1.depth + pt2.depth + pt3.depth) / 4 - 0.05,
            fill: `rgb(${Math.min(255, baseR + 35)}, ${Math.min(255, baseG + 30)}, ${Math.min(255, baseB + 20)})`,
            stroke: strokeCol,
            strokeWidth: 1.2,
            key: `obj-top-${node.room.id}-${oIdx}`,
          });

          faces.push({
            points: [pb0, pb1, pt1, pt0],
            avgDepth: (pb0.depth + pb1.depth + pt1.depth + pt0.depth) / 4,
            fill: `rgb(${baseR}, ${baseG}, ${baseB})`,
            stroke: strokeCol,
            strokeWidth: 1.0,
            key: `obj-back-${node.room.id}-${oIdx}`,
          });

          faces.push({
            points: [pb1, pb2, pt2, pt1],
            avgDepth: (pb1.depth + pb2.depth + pt2.depth + pt1.depth) / 4,
            fill: `rgb(${Math.round(baseR * 0.9)}, ${Math.round(baseG * 0.9)}, ${Math.round(baseB * 0.9)})`,
            stroke: strokeCol,
            strokeWidth: 1.0,
            key: `obj-right-${node.room.id}-${oIdx}`,
          });

          faces.push({
            points: [pb2, pb3, pt3, pt2],
            avgDepth: (pb2.depth + pb3.depth + pt3.depth + pt2.depth) / 4,
            fill: `rgb(${Math.round(baseR * 0.85)}, ${Math.round(baseG * 0.85)}, ${Math.round(baseB * 0.88)})`,
            stroke: strokeCol,
            strokeWidth: 1.0,
            key: `obj-front-${node.room.id}-${oIdx}`,
          });

          faces.push({
            points: [pb3, pb0, pt0, pt3],
            avgDepth: (pb3.depth + pb0.depth + pt0.depth + pt3.depth) / 4,
            fill: `rgb(${Math.round(baseR * 0.95)}, ${Math.round(baseG * 0.95)}, ${Math.round(baseB * 0.95)})`,
            stroke: strokeCol,
            strokeWidth: 1.0,
            key: `obj-left-${node.room.id}-${oIdx}`,
          });
        });
      }

      // 4. Ceiling Wireframe Canopy
      const ceilingProjected = polygon.map((p) =>
        projectCADVertex(p.x * 0.3048, effectiveHeightM, p.z * 0.3048)
      );
      canopies.push({
        points: ceilingProjected,
        key: `canopy-${node.room.id}`,
      });
    }

    faces.sort((a, b) => b.avgDepth - a.avgDepth);

    return { allFaces3D: faces, allCanopies: canopies };
  }, [placedRoomNodes, angleX, angleY, zoom, panOffset, selectedRoomId, viewW, viewH, layers.furniture, threeDHeightMode]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f7" />
      <View style={styles.container}>
        {/* Top Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.navBackText}>‹ Rooms</Text>
          </TouchableOpacity>
          <View style={styles.navTitleGroup}>
            <Text style={styles.navTitle}>House Assembly</Text>
            <Text style={styles.navSubtitle}>
              {placedRoomNodes.length} Rooms Placed • {Math.round(totalArea)} sq ft
            </Text>
          </View>
          <View style={{ width: 60 }} />
        </View>

        {/* Hero CAD Viewport */}
        <View
          ref={viewportRef}
          collapsable={false}
          style={styles.viewportArea}
          onLayout={handleViewportLayout}
        >
          {/* Layer 1: Gesture Surface for SVG Canvas */}
          <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
            <Svg width={viewW} height={viewH} pointerEvents="none" style={styles.cadCanvas}>
              {/* Background architectural grid */}
              <Rect x="0" y="0" width={viewW} height={viewH} fill="#ffffff" />
              {[-120, -60, 0, 60, 120].map((step, idx) => (
                <React.Fragment key={`grid-${idx}`}>
                  <Line
                    x1="0"
                    y1={viewH / 2 + step}
                    x2={viewW}
                    y2={viewH / 2 + step}
                    stroke="#f5f5f7"
                    strokeWidth="1"
                  />
                  <Line
                    x1={viewW / 2 + step}
                    y1="0"
                    x2={viewW / 2 + step}
                    y2={viewH}
                    stroke="#f5f5f7"
                    strokeWidth="1"
                  />
                </React.Fragment>
              ))}

              {viewMode === '2d' ? (
                // ==========================================
                // 2D PLAN VIEW (Certified CAD Floorplan - Straightened)
                // ==========================================
                <G>
                  {/* Render Placed Room Nodes */}
                  {placedRoomNodes.map((n) => {
                    const room = n.room;
                    let parsedMesh: any = null;
                    try {
                      if (room.mesh_json) parsedMesh = JSON.parse(room.mesh_json);
                    } catch {}

                    const realWalls: any[] = parsedMesh?.walls || [];
                    const realDoors: any[] = parsedMesh?.doors || [];
                    const realWindows: any[] = parsedMesh?.windows || [];
                    const realObjects: any[] = parsedMesh?.objects || [];

                    const polygon = GeometryService.buildRoomPolygon(realWalls, n.w, n.l);
                    const N = polygon.length;
                    const centerPoly = {
                      x: polygon.reduce((acc, p) => acc + p.x, 0) / N,
                      z: polygon.reduce((acc, p) => acc + p.z, 0) / N,
                    };

                    const totalRad = (n.rotation * Math.PI) / 180 + n.orthoAngle;
                    const cosR = Math.cos(totalRad);
                    const sinR = Math.sin(totalRad);

                    const roomLocalToCanvas = (lx: number, lz: number) => {
                      const relX = lx - centerPoly.x;
                      const relZ = lz - centerPoly.z;
                      const wx = n.x + (relX * cosR - relZ * sinR);
                      const wz = n.z + (relX * sinR + relZ * cosR);
                      return worldToCanvas(wx, wz);
                    };

                    const polyCanvasPoints = polygon.map((p) => {
                      const pt = roomLocalToCanvas(p.x, p.z);
                      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
                    }).join(' ');

                    const isSelected = n.room.id === selectedRoomId;
                    const isHeld = n.room.id === heldRoomId;
                    const centerCanvas = roomLocalToCanvas(centerPoly.x, centerPoly.z);

                    // Border color: Light Orange when press-held, Blue when selected, Dark when idle
                    const strokeColor = isHeld ? '#f97316' : isSelected ? '#007aff' : '#1c1c1e';
                    const strokeWidth = isHeld ? 4.5 : isSelected ? Math.max(4.5, 5.5 * zoom) : Math.max(3.5, 4.5 * zoom);
                    const fillColor = isHeld ? '#fffaf0' : '#ffffff';

                    return (
                      <G
                        key={`room2d-${n.room.id}`}
                        onPress={() => {
                          setSelectedRoomId(n.room.id);
                          triggerHaptic();
                        }}
                      >
                        {/* Outer Wall Boundary */}
                        <Polygon
                          points={polyCanvasPoints}
                          fill={fillColor}
                          stroke={strokeColor}
                          strokeWidth={strokeWidth}
                          strokeLinejoin="miter"
                        />

                        {/* Inner Core Wall Line */}
                        <Polygon
                          points={polyCanvasPoints}
                          fill="none"
                          stroke={isHeld ? 'rgba(249, 115, 22, 0.4)' : isSelected ? 'rgba(0,122,255,0.4)' : '#64748b'}
                          strokeWidth={isHeld ? 2 : Math.max(1.5, 2 * zoom)}
                        />

                        {/* Layer: Wall Segment Dimension Callouts */}
                        {layers.dimensions &&
                          polygon.map((p1, idx) => {
                            const p2 = polygon[(idx + 1) % N];
                            const pt1 = roomLocalToCanvas(p1.x, p1.z);
                            const pt2 = roomLocalToCanvas(p2.x, p2.z);
                            const midX = (pt1.x + pt2.x) / 2;
                            const midY = (pt1.y + pt2.y) / 2;
                            const segLenFt = Math.hypot(p2.x - p1.x, p2.z - p1.z);
                            const dx = pt2.x - pt1.x, dy = pt2.y - pt1.y;
                            const dLen = Math.hypot(dx, dy) || 1;
                            const offX = (-dy / dLen) * 14;
                            const offY = (dx / dLen) * 14;

                            return (
                              <SvgText
                                key={`wall-lbl-${n.room.id}-${idx}`}
                                x={midX + offX}
                                y={midY + offY + 3}
                                fill={isHeld ? '#ea580c' : '#007aff'}
                                fontSize={Math.max(8, 9 * Math.min(1.4, zoom))}
                                fontWeight="700"
                                textAnchor="middle"
                              >
                                {GeometryService.formatFeetInches(segLenFt)}
                              </SvgText>
                            );
                          })}

                        {/* Layer: Render True Door Openings & Swings */}
                        {layers.doorsWindows &&
                          realDoors.map((d, dIdx) => {
                            const d1 = roomLocalToCanvas(d.x1 ?? (d.x - 1.5), d.z1 ?? (d.z - 1.5));
                            const d2 = roomLocalToCanvas(d.x2 ?? (d.x + 1.5), d.z2 ?? (d.z + 1.5));
                            const dLen = Math.hypot(d2.x - d1.x, d2.y - d1.y) || (20 * zoom);

                            return (
                              <G key={`door-2d-${n.room.id}-${dIdx}`}>
                                <Line x1={d1.x} y1={d1.y} x2={d2.x} y2={d2.y} stroke="#ffffff" strokeWidth={Math.max(6, 8 * zoom)} />
                                <Path
                                  d={`M ${d1.x} ${d1.y} A ${dLen} ${dLen} 0 0 1 ${d2.x} ${d2.y}`}
                                  fill="none"
                                  stroke={isHeld ? '#ea580c' : '#007aff'}
                                  strokeWidth={1.2}
                                  strokeDasharray="3,3"
                                />
                                <Line x1={d1.x} y1={d1.y} x2={d1.x} y2={d1.y - dLen * 0.7} stroke={isHeld ? '#ea580c' : '#007aff'} strokeWidth={2} />
                              </G>
                            );
                          })}

                        {/* Layer: Render True Windows (AIA 3-Line CAD) */}
                        {layers.doorsWindows &&
                          realWindows.map((win, wIdx) => {
                            const w1 = roomLocalToCanvas(win.x1 ?? (win.x - 1.5), win.z1 ?? (win.z - 1.5));
                            const w2 = roomLocalToCanvas(win.x2 ?? (win.x + 1.5), win.z2 ?? (win.z + 1.5));
                            const dx = w2.x - w1.x;
                            const dy = w2.y - w1.y;
                            const wLen = Math.hypot(dx, dy) || 1;
                            const nx = (-dy / wLen) * 2.5;
                            const ny = (dx / wLen) * 2.5;

                            return (
                              <G key={`win-2d-${n.room.id}-${wIdx}`}>
                                <Line x1={w1.x} y1={w1.y} x2={w2.x} y2={w2.y} stroke="#ffffff" strokeWidth={Math.max(6, 8 * zoom)} />
                                <Line x1={w1.x + nx} y1={w1.y + ny} x2={w2.x + nx} y2={w2.y + ny} stroke="#1c1c1e" strokeWidth={1.2} />
                                <Line x1={w1.x} y1={w1.y} x2={w2.x} y2={w2.y} stroke="#007aff" strokeWidth={1.0} />
                                <Line x1={w1.x - nx} y1={w1.y - ny} x2={w2.x - nx} y2={w2.y - ny} stroke="#1c1c1e" strokeWidth={1.2} />
                              </G>
                            );
                          })}

                        {/* Layer: Render Detected Objects with Exact CAD Oriented Bounding Box (OBB) */}
                        {layers.furniture &&
                          realObjects.map((obj, oIdx) => {
                            const halfW = (obj.widthFt || 3) / 2;
                            const halfL = (obj.lengthFt || 3) / 2;

                            let ux = 1, uz = 0;
                            let vx = 0, vz = 1;

                            if (obj.dirXx !== undefined && obj.dirXz !== undefined) {
                              const lenX = Math.hypot(obj.dirXx, obj.dirXz) || 1;
                              ux = obj.dirXx / lenX;
                              uz = obj.dirXz / lenX;
                              if (obj.dirZx !== undefined && obj.dirZz !== undefined) {
                                const lenZ = Math.hypot(obj.dirZx, obj.dirZz) || 1;
                                vx = obj.dirZx / lenZ;
                                vz = obj.dirZz / lenZ;
                              } else {
                                vx = -uz;
                                vz = ux;
                              }
                            } else if (obj.yawDeg !== undefined) {
                              const r = (obj.yawDeg * Math.PI) / 180;
                              ux = Math.cos(r);
                              uz = Math.sin(r);
                              vx = -uz;
                              vz = ux;
                            }

                            const ox = obj.x ?? 0;
                            const oz = obj.z ?? 0;
                            const c0 = roomLocalToCanvas(ox - halfW * ux - halfL * vx, oz - halfW * uz - halfL * vz);
                            const c1 = roomLocalToCanvas(ox + halfW * ux - halfL * vx, oz + halfW * uz - halfL * vz);
                            const c2 = roomLocalToCanvas(ox + halfW * ux + halfL * vx, oz + halfW * uz + halfL * vz);
                            const c3 = roomLocalToCanvas(ox - halfW * ux + halfL * vx, oz - halfW * uz + halfL * vz);

                            const polyPts = `${c0.x.toFixed(1)},${c0.y.toFixed(1)} ${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${c3.x.toFixed(1)},${c3.y.toFixed(1)}`;
                            const centerObj = roomLocalToCanvas(ox, oz);

                            return (
                              <G key={`obj2d-${n.room.id}-${oIdx}`}>
                                <Polygon
                                  points={polyPts}
                                  fill="#eff6ff"
                                  stroke="#2563eb"
                                  strokeWidth={1.2}
                                />
                                {layers.labels && (
                                  <SvgText
                                    x={centerObj.x}
                                    y={centerObj.y + 3}
                                    fill="#1d4ed8"
                                    fontSize={8}
                                    fontWeight="700"
                                    textAnchor="middle"
                                  >
                                    {obj.category?.split(' ')[0] || 'Item'}
                                  </SvgText>
                                )}
                              </G>
                            );
                          })}

                        {/* Layer: Center Room Area & Name Text */}
                        {layers.labels && (
                          <>
                            <SvgText
                              x={centerCanvas.x}
                              y={centerCanvas.y - 6}
                              fill="#1c1c1e"
                              fontSize={Math.max(11, 12 * Math.min(1.4, zoom))}
                              fontWeight="700"
                              textAnchor="middle"
                            >
                              {n.room.name.split('(')[0].trim().toUpperCase()}
                            </SvgText>
                            <SvgText
                              x={centerCanvas.x}
                              y={centerCanvas.y + 10}
                              fill={isHeld ? '#ea580c' : '#007aff'}
                              fontSize={Math.max(9, 10 * Math.min(1.4, zoom))}
                              fontWeight="600"
                              textAnchor="middle"
                            >
                              {GeometryService.formatAreaSqFt(n.room.area_sqft || (n.w * n.l))}
                            </SvgText>
                          </>
                        )}

                        {/* Rotation handle on corner of selected room (tap to rotate) */}
                        {isSelected && (() => {
                          const b = computeRoomGeometryBounds(n);
                          const hX = centerCanvas.x + b.halfMaxX * scale2D - 14;
                          const hY = centerCanvas.y + b.halfMinZ * scale2D + 14;
                          return (
                            <G
                              onPress={() => {
                                handleRotateSelectedRoom();
                                triggerHaptic();
                              }}
                            >
                              <Circle
                                cx={hX}
                                cy={hY}
                                r={14}
                                fill={isHeld ? '#ea580c' : '#007aff'}
                              />
                              <SvgText
                                x={hX}
                                y={hY + 4.5}
                                fill="#ffffff"
                                fontSize={12}
                                fontWeight="700"
                                textAnchor="middle"
                              >
                                ↻
                              </SvgText>
                            </G>
                          );
                        })()}
                      </G>
                    );
                  })}

                  {/* Collinear Magnetic Snap Guide Line */}
                  {activeSnapGuide && (
                    <G>
                      {(() => {
                        const p1 = worldToCanvas(activeSnapGuide.x1, activeSnapGuide.z1);
                        const p2 = worldToCanvas(activeSnapGuide.x2, activeSnapGuide.z2);
                        const anc = worldToCanvas(activeSnapGuide.anchorX, activeSnapGuide.anchorZ);
                        const key = `${activeSnapGuide.x1.toFixed(1)}_${activeSnapGuide.z1.toFixed(1)}_${activeSnapGuide.x2.toFixed(1)}_${activeSnapGuide.z2.toFixed(1)}`;
                        const isFused = mergedPartitions.has(key);

                        return (
                          <>
                            <Line
                              x1={p1.x}
                              y1={p1.y}
                              x2={p2.x}
                              y2={p2.y}
                              stroke={isFused ? '#007aff' : '#34c759'}
                              strokeWidth={isFused ? 3.5 : 2.5}
                              strokeDasharray={isFused ? undefined : '6,4'}
                              strokeLinecap="round"
                            />
                            <Circle cx={anc.x} cy={anc.y} r={7} fill="#34c759" opacity={0.25} />
                            <Circle cx={anc.x} cy={anc.y} r={3.5} fill="#34c759" />
                          </>
                        );
                      })()}
                    </G>
                  )}
                </G>
              ) : (
                // ==========================================
                // 3D ISOMETRIC DOLLHOUSE (Full CAD Geometry Engine)
                // ==========================================
                <G>
                  {/* 3D Depth-Sorted Solid Facets (Walls, Apertures, Furniture) */}
                  {allFaces3D.map((face) => (
                    <Polygon
                      key={face.key}
                      points={face.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
                      fill={face.fill}
                      stroke={face.stroke}
                      strokeWidth={face.strokeWidth}
                      strokeLinejoin="round"
                      opacity={face.opacity ?? 1.0}
                    />
                  ))}

                  {/* 3D Wireframe Ceiling Canopies */}
                  {allCanopies.map((canopy) => (
                    <Polygon
                      key={canopy.key}
                      points={canopy.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="1.5"
                      strokeDasharray="4,4"
                    />
                  ))}
                </G>
              )}

            </Svg>

            {/* Empty Canvas Notice */}
            {placedRoomNodes.length === 0 && (
              <View style={styles.emptyCanvasNotice}>
                <Text style={styles.emptyCanvasIcon}>🧊</Text>
                <Text style={styles.emptyCanvasTitle}>No Rooms on Canvas</Text>
                <Text style={styles.emptyCanvasSub}>
                  Tap "+ Add to Studio" on any room below to place it.
                </Text>
              </View>
            )}
          </View>

          {/* Layer 2: Floating UI Overlays (z-index 40, Sibling to Canvas) */}

          {/* Selected Room Floating Action Dock (Top of canvas) */}
          {selectedNode && (
            <View style={styles.selectedRoomDock}>
              <View style={styles.selInfo}>
                <View style={styles.selNameRow}>
                  <Text style={[styles.selDot, heldRoomId === selectedNode.room.id && styles.selDotHeld]}>●</Text>
                  <Text style={styles.selNameText} numberOfLines={1}>
                    {selectedNode.room.name.split('(')[0].trim()}
                  </Text>
                  {heldRoomId === selectedNode.room.id && (
                    <View style={styles.movingPill}>
                      <Text style={styles.movingPillText}>Moving</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.selDimsText}>
                  {Math.round(selectedNode.rotation % 180 === 0 ? selectedNode.w : selectedNode.l)}' ×{' '}
                  {Math.round(selectedNode.rotation % 180 === 0 ? selectedNode.l : selectedNode.w)}' •{' '}
                  {Math.round(selectedNode.w * selectedNode.l)} sq ft • {selectedNode.rotation}°
                </Text>
              </View>

              <View style={styles.selActions}>
                {/* ↻ Rotate Icon Button */}
                <TouchableOpacity
                  style={[styles.actionIconBtn, styles.btnRotate]}
                  onPress={handleRotateSelectedRoom}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={styles.rotateGlyph}>↻</Text>
                </TouchableOpacity>

                {/* ✕ Delete Icon Button */}
                <TouchableOpacity
                  style={[styles.actionIconBtn, styles.btnDelete]}
                  onPress={handleRemoveSelectedRoom}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={styles.deleteGlyph}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Apple Maps-Style Top-Right Dual Stack: Layers + 3D Rotate Toggle (Option A) */}
          <View style={styles.floatingTopRightStack} pointerEvents="box-none">
            {/* Button 1: Map Layers */}
            <TouchableOpacity
              style={styles.floatingLayerBtn}
              onPress={() => setShowLayerMenu(true)}
              activeOpacity={0.8}
              accessibilityLabel="Map Layers"
              accessibilityRole="button"
            >
              {/* Stacked Map Layers 3D Vector Icon */}
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  stroke="#1c1c1e"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d="M2 12L12 17L22 12"
                  stroke="#1c1c1e"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d="M2 17L12 22L22 17"
                  stroke="#1c1c1e"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>

              {/* Active Badge: Highlights when extra layers (Dimensions, Labels, Furniture) are active */}
              {(layers.dimensions || layers.labels || layers.furniture) && (
                <View style={styles.layerActiveDot} />
              )}
            </TouchableOpacity>

            {/* Button 2: 3D Rotate House Toggle (Option A: 3D Cube with Orbit Arrow) - ONLY VISIBLE IN 3D MODE */}
            {viewMode === '3d' && (
              <TouchableOpacity
                style={[
                  styles.floatingRotateBtn,
                  isHouseRotateMode && styles.floatingRotateBtnActive,
                ]}
                onPress={toggleHouseRotateMode}
                activeOpacity={0.8}
                accessibilityLabel={isHouseRotateMode ? "Rotate House Mode Active" : "Enable Rotate House Mode"}
                accessibilityRole="button"
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  {/* 3D Isometric Cube */}
                  <Path
                    d="M12 2.5l6.5 3.75v7.5L12 17.5l-6.5-3.75v-7.5L12 2.5z"
                    stroke={isHouseRotateMode ? 'rgba(255,255,255,0.7)' : '#636366'}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Path
                    d="M12 2.5v15M18.5 6.25L12 10 5.5 6.25"
                    stroke={isHouseRotateMode ? 'rgba(255,255,255,0.7)' : '#636366'}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* 3D Perspective Orbit Ring */}
                  <Path
                    d="M2.5 16.5C3.8 19.5 7.5 21.5 12 21.5c5.5 0 10-3 10-6.5 0-1.8-1.2-3.4-3.2-4.5"
                    stroke={isHouseRotateMode ? '#ffffff' : '#1c1c1e'}
                    strokeWidth={2.2}
                    strokeLinecap="round"
                  />
                  <Path
                    d="M2.5 13.5V17H6"
                    stroke={isHouseRotateMode ? '#ffffff' : '#1c1c1e'}
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </TouchableOpacity>
            )}
          </View>

          {/* Apple Maps-Style Layer Selection Modal Bottom Sheet */}
          <Modal
            visible={showLayerMenu}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowLayerMenu(false)}
          >
            <TouchableOpacity
              style={styles.sheetBackdrop}
              activeOpacity={1}
              onPress={() => setShowLayerMenu(false)}
            >
              <View
                style={styles.sheetContainer}
                onStartShouldSetResponder={() => true}
                onTouchEnd={(e) => e.stopPropagation()}
              >
                {/* Sheet Grab Handle */}
                <View style={styles.sheetHandle} />

                {/* Sheet Header */}
                <View style={styles.sheetHeader}>
                  <View>
                    <Text style={styles.sheetTitle}>CAD Layers</Text>
                    <Text style={styles.sheetSubtitle}>
                      {`${(layers.doorsWindows ? 1 : 0) + (layers.dimensions ? 1 : 0) + (layers.labels ? 1 : 0) + (layers.furniture ? 1 : 0)} of 4 layers enabled`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.sheetCloseBtn}
                    onPress={() => setShowLayerMenu(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.sheetCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Layer Toggle Rows */}
                <View style={styles.sheetRowsContainer}>
                  {/* 1. Doors & Windows */}
                  <View style={styles.sheetRow}>
                    <View style={styles.sheetRowInfo}>
                      <View style={[styles.sheetIconBox, { backgroundColor: '#fef3c7' }]}>
                        <Text style={styles.sheetIconGlyph}>🚪</Text>
                      </View>
                      <View>
                        <Text style={styles.sheetRowTitle}>Doors & Windows</Text>
                        <Text style={styles.sheetRowDesc}>Wall apertures and swing arcs</Text>
                      </View>
                    </View>
                    <Switch
                      value={layers.doorsWindows}
                      onValueChange={(val) => setLayers((prev) => ({ ...prev, doorsWindows: val }))}
                      trackColor={{ false: '#e5e5ea', true: '#007aff' }}
                      thumbColor="#ffffff"
                      ios_backgroundColor="#e5e5ea"
                    />
                  </View>

                  {/* 2. Dimensions */}
                  <View style={styles.sheetRow}>
                    <View style={styles.sheetRowInfo}>
                      <View style={[styles.sheetIconBox, { backgroundColor: '#eff6ff' }]}>
                        <Text style={styles.sheetIconGlyph}>📏</Text>
                      </View>
                      <View>
                        <Text style={styles.sheetRowTitle}>Dimensions</Text>
                        <Text style={styles.sheetRowDesc}>CAD wall lengths & measurements</Text>
                      </View>
                    </View>
                    <Switch
                      value={layers.dimensions}
                      onValueChange={(val) => setLayers((prev) => ({ ...prev, dimensions: val }))}
                      trackColor={{ false: '#e5e5ea', true: '#007aff' }}
                      thumbColor="#ffffff"
                      ios_backgroundColor="#e5e5ea"
                    />
                  </View>

                  {/* 3. Room Labels & Areas */}
                  <View style={styles.sheetRow}>
                    <View style={styles.sheetRowInfo}>
                      <View style={[styles.sheetIconBox, { backgroundColor: '#ecfdf5' }]}>
                        <Text style={styles.sheetIconGlyph}>🏷️</Text>
                      </View>
                      <View>
                        <Text style={styles.sheetRowTitle}>Room Labels & Areas</Text>
                        <Text style={styles.sheetRowDesc}>Room names and square footage</Text>
                      </View>
                    </View>
                    <Switch
                      value={layers.labels}
                      onValueChange={(val) => setLayers((prev) => ({ ...prev, labels: val }))}
                      trackColor={{ false: '#e5e5ea', true: '#007aff' }}
                      thumbColor="#ffffff"
                      ios_backgroundColor="#e5e5ea"
                    />
                  </View>

                  {/* 4. Furniture */}
                  <View style={styles.sheetRow}>
                    <View style={styles.sheetRowInfo}>
                      <View style={[styles.sheetIconBox, { backgroundColor: '#f3e8ff' }]}>
                        <Text style={styles.sheetIconGlyph}>🛋️</Text>
                      </View>
                      <View>
                        <Text style={styles.sheetRowTitle}>Furniture & Fixtures</Text>
                        <Text style={styles.sheetRowDesc}>Scanned 3D bounding boxes</Text>
                      </View>
                    </View>
                    <Switch
                      value={layers.furniture}
                      onValueChange={(val) => setLayers((prev) => ({ ...prev, furniture: val }))}
                      trackColor={{ false: '#e5e5ea', true: '#007aff' }}
                      thumbColor="#ffffff"
                      ios_backgroundColor="#e5e5ea"
                    />
                  </View>
                </View>

                {/* Done Button */}
                <TouchableOpacity
                  style={styles.sheetDoneBtn}
                  onPress={() => setShowLayerMenu(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.sheetDoneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Apple Freeform Unified Floating Capsule (Bottom Center) */}
          <View style={styles.freeformCapsuleWrap} pointerEvents="box-none">
            <View style={styles.freeformCapsule}>
              {/* ＋ Insert Room Button */}
              <TouchableOpacity
                style={styles.freeformAddBtn}
                onPress={() => setShowRoomPicker(true)}
                activeOpacity={0.8}
                accessibilityLabel="Add Room"
              >
                <Text style={styles.freeformAddBtnText}>＋</Text>
              </TouchableOpacity>

              <View style={styles.freeformDivider} />

              {/* Contextual 3D Height Switcher (Only visible in 3D Mode) */}
              {viewMode === '3d' && (
                <>
                  <View style={styles.freeformSegment}>
                    <TouchableOpacity
                      style={[styles.freeformSegBtn, threeDHeightMode === '4ft' && styles.freeformSegBtnActive]}
                      onPress={() => setThreeDHeightMode('4ft')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.freeformSegText, threeDHeightMode === '4ft' && styles.freeformSegTextActive]}>
                        ✂ 4'
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.freeformSegBtn, threeDHeightMode === 'ceil' && styles.freeformSegBtnActive]}
                      onPress={() => setThreeDHeightMode('ceil')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.freeformSegText, threeDHeightMode === 'ceil' && styles.freeformSegTextActive]}>
                        🏛 Ceil
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.freeformDivider} />
                </>
              )}

              {/* 2D / 3D Mode Switcher */}
              <View style={styles.freeformSegment}>
                <TouchableOpacity
                  style={[styles.freeformSegBtn, viewMode === '2d' && styles.freeformSegBtnActive]}
                  onPress={() => {
                    setViewMode('2d');
                    setIsHouseRotateMode(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.freeformSegText, viewMode === '2d' && styles.freeformSegTextActive]}>
                    2D
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.freeformSegBtn, viewMode === '3d' && styles.freeformSegBtnActive]}
                  onPress={() => setViewMode('3d')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.freeformSegText, viewMode === '3d' && styles.freeformSegTextActive]}>
                    3D
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Style 2: Floating Lower-Right Satellite Export Button (Contextual STL in 3D / PDF in 2D) */}
          <View style={styles.floatingExportBtnWrap} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.floatingExportBtn}
              onPress={viewMode === '3d' ? handleExportSheet : handleExportPdf}
              activeOpacity={0.8}
              accessibilityLabel={viewMode === '3d' ? 'Export 3D Solid Model' : 'Export Floor Plan PDF'}
              accessibilityRole="button"
            >
              {viewMode === '3d' ? (
                <>
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
                      stroke="#007aff"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Path
                      d="M3.27 6.96L12 12.01L20.73 6.96"
                      stroke="#007aff"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Line
                      x1={12}
                      y1={22.08}
                      x2={12}
                      y2={12}
                      stroke="#007aff"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                    />
                  </Svg>
                  <Text style={styles.floatingExportTextStl}>STL</Text>
                </>
              ) : (
                <>
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                      stroke="#ff3b30"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Path
                      d="M14 2V8H20"
                      stroke="#ff3b30"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Line
                      x1={8}
                      y1={13}
                      x2={16}
                      y2={13}
                      stroke="#ff3b30"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                    />
                    <Line
                      x1={8}
                      y1={17}
                      x2={12}
                      y2={17}
                      stroke="#ff3b30"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                    />
                  </Svg>
                  <Text style={styles.floatingExportTextPdf}>PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Apple HIG Room Library Modal Sheet (Replaces the clunky 140px bottom tray) */}
        <Modal
          visible={showRoomPicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowRoomPicker(false)}
        >
          <TouchableOpacity
            style={styles.sheetBackdrop}
            activeOpacity={1}
            onPress={() => setShowRoomPicker(false)}
          >
            <View
              style={styles.sheetContainer}
              onStartShouldSetResponder={() => true}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.sheetTitle}>Room Library</Text>
                  <Text style={styles.sheetSubtitle}>
                    {placedRoomNodes.length} of {allRooms.length} rooms placed on canvas
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.sheetCloseBtn}
                  onPress={() => setShowRoomPicker(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.sheetCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.roomPickerScroll} showsVerticalScrollIndicator={false}>
                {allRooms.map((r, idx) => {
                  const isPlaced = placedRoomNodes.some((n) => n.room.id === r.id);
                  const isSelected = selectedRoomId === r.id;
                  const rw = Math.round(r.width_ft || 16);
                  const rl = Math.round(r.length_ft || 14);
                  const rh = Math.round(r.height_ft || 8.5);

                  return (
                    <View key={r.id} style={[styles.roomPickerCard, isPlaced && styles.roomPickerCardPlaced]}>
                      <View style={styles.roomPickerCardInfo}>
                        <View style={[styles.roomPickerNumBadge, isPlaced && styles.roomPickerNumBadgePlaced]}>
                          <Text style={[styles.roomPickerNumText, isPlaced && styles.roomPickerNumTextPlaced]}>
                            {idx + 1}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.roomPickerCardTitle} numberOfLines={1}>
                            {r.name.split('(')[0].trim()}
                          </Text>
                          <Text style={styles.roomPickerCardMeta}>
                            {rw}' × {rl}' • {rw * rl} sq ft • {rh}' ceiling
                          </Text>
                        </View>
                      </View>

                      {isPlaced ? (
                        <TouchableOpacity
                          style={styles.roomPickerAddedPill}
                          onPress={() => {
                            setSelectedRoomId(r.id);
                            setShowRoomPicker(false);
                          }}
                        >
                          <Text style={styles.roomPickerAddedText}>✓ Placed</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.roomPickerAddBtn}
                          onPress={() => {
                            handleAddRoomToCanvas(r);
                            setShowRoomPicker(false);
                          }}
                        >
                          <Text style={styles.roomPickerAddBtnText}>＋ Add</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={styles.sheetDoneBtn}
                onPress={() => setShowRoomPicker(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.sheetDoneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f5f5f7',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e5ea',
  },
  navBackText: {
    fontSize: 16,
    color: '#007aff',
    fontWeight: '500',
  },
  navTitleGroup: {
    alignItems: 'center',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1c1c1e',
    letterSpacing: -0.3,
  },
  navSubtitle: {
    fontSize: 11,
    color: '#8e8e93',
    fontWeight: '500',
    marginTop: 1,
  },
  navDoneText: {
    fontSize: 16,
    color: '#007aff',
    fontWeight: '600',
  },

  // 2 Main Tabs
  mainTabsWrap: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f7',
  },
  mainTabs: {
    flexDirection: 'row',
    backgroundColor: '#e5e5ea',
    borderRadius: 12,
    padding: 3,
    height: 36,
  },
  mainTab: {
    flex: 1,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mainTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8e8e93',
  },
  mainTabTextActive: {
    color: '#1c1c1e',
  },
  tabBadge: {
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#007aff',
  },

  // Hero Viewport Area
  viewportArea: {
    flex: 1,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e5ea',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  cadCanvas: {
    flex: 1,
  },

  // Empty Canvas Notice
  emptyCanvasNotice: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    pointerEvents: 'none',
  },
  emptyCanvasIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyCanvasTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1c1c1e',
    marginBottom: 4,
  },
  emptyCanvasSub: {
    fontSize: 13,
    color: '#8e8e93',
    textAlign: 'center',
  },

  // Selected Room Dock (Top of canvas)
  selectedRoomDock: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 58,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#e5e5ea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 40,
  },
  selInfo: {
    flexDirection: 'column',
    flex: 1,
  },
  selNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selDot: {
    color: '#007aff',
    fontSize: 10,
  },
  selDotHeld: {
    color: '#f97316',
  },
  movingPill: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  movingPillText: {
    color: '#ea580c',
    fontSize: 9,
    fontWeight: '700',
  },
  selNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1c1c1e',
  },
  selDimsText: {
    fontSize: 11,
    color: '#8e8e93',
    fontWeight: '500',
    marginTop: 1,
  },
  selActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRotate: {
    backgroundColor: '#f0f4ff',
  },
  btnDelete: {
    backgroundColor: '#fff2f2',
  },
  rotateGlyph: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007aff',
  },
  deleteGlyph: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ff3b30',
  },

  // Apple Maps-Style Top-Right Dual Stack: Layers + 3D Rotate Toggle (Option A)
  floatingTopRightStack: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 40,
    flexDirection: 'column',
    gap: 8,
  },
  floatingLayerBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 0.5,
    borderColor: '#d1d1d6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  floatingRotateBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 0.5,
    borderColor: '#d1d1d6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  floatingRotateBtnActive: {
    backgroundColor: '#007aff',
    borderColor: '#007aff',
    shadowColor: '#007aff',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  layerActiveDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007aff',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },

  // Apple Maps-Style Layer Selection Modal Bottom Sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.40)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  sheetHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#d1d1d6',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e5ea',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1c1c1e',
  },
  sheetSubtitle: {
    fontSize: 13,
    color: '#8e8e93',
    marginTop: 2,
    fontWeight: '500',
  },
  sheetCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f2f2f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8e8e93',
  },
  sheetRowsContainer: {
    paddingVertical: 14,
    gap: 16,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetRowInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetIconGlyph: {
    fontSize: 18,
  },
  sheetRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  sheetRowDesc: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 1,
  },
  sheetDoneBtn: {
    marginTop: 8,
    backgroundColor: '#1c1c1e',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  sheetDoneBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Apple Freeform Unified Floating Capsule (Bottom Center)
  freeformCapsuleWrap: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 40,
  },
  freeformCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 24,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderWidth: 0.5,
    borderColor: '#e5e5ea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    gap: 6,
  },
  freeformAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#007aff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007aff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  freeformAddBtnText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
  },
  freeformDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#e5e5ea',
  },
  freeformSegment: {
    flexDirection: 'row',
    backgroundColor: '#f2f2f7',
    borderRadius: 16,
    padding: 2,
    gap: 2,
  },
  freeformSegBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freeformSegBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  freeformSegText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8e8e93',
  },
  freeformSegTextActive: {
    color: '#1c1c1e',
  },

  // Style 2: Floating Lower-Right Satellite Export Button
  floatingExportBtnWrap: {
    position: 'absolute',
    bottom: 16,
    right: 12,
    zIndex: 40,
  },
  floatingExportBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 0.5,
    borderColor: '#d1d1d6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    gap: 0.5,
  },
  floatingExportTextStl: {
    fontSize: 8,
    fontWeight: '800',
    color: '#007aff',
    letterSpacing: 0.2,
    lineHeight: 9,
  },
  floatingExportTextPdf: {
    fontSize: 8,
    fontWeight: '800',
    color: '#ff3b30',
    letterSpacing: 0.2,
    lineHeight: 9,
  },

  // Room Picker Modal Sheet
  roomPickerScroll: {
    maxHeight: 280,
    marginVertical: 12,
  },
  roomPickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e5ea',
    marginBottom: 8,
  },
  roomPickerCardPlaced: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  roomPickerCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  roomPickerNumBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#007aff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomPickerNumBadgePlaced: {
    backgroundColor: '#e2e8f0',
  },
  roomPickerNumText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  roomPickerNumTextPlaced: {
    color: '#64748b',
  },
  roomPickerCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1c1c1e',
  },
  roomPickerCardMeta: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 2,
  },
  roomPickerAddBtn: {
    backgroundColor: '#007aff',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
  },
  roomPickerAddBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  roomPickerAddedPill: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  roomPickerAddedText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
});
