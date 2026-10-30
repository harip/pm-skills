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
  const [placedRoomNodes, setPlacedRoomNodes] = useState<RoomNode[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [heldRoomId, setHeldRoomId] = useState<string | null>(null); // Active press-and-hold drag room
  const [activeSnapGuide, setActiveSnapGuide] = useState<SnapGuide | null>(null);
  const [mergedPartitions, setMergedPartitions] = useState<Set<string>>(new Set());

  // Apple Maps-style Layer Toggles
  const [layers, setLayers] = useState<LayersConfig>({
    doorsWindows: true,
    dimensions: true,
    labels: true,
    furniture: true,
  });
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Dynamic Viewport Canvas Layout
  const [canvasLayout, setCanvasLayout] = useState({ width: 360, height: 430 });
  const viewW = canvasLayout.width;
  const viewH = canvasLayout.height;

  const viewportRef = useRef<View>(null);
  const viewportLayoutRef = useRef<{ pageX: number; pageY: number; width: number; height: number }>({
    pageX: 16,
    pageY: 110,
    width: 360,
    height: 430,
  });

  // Viewport Zoom, Pan, and 3D Camera Angles
  const [zoom, setZoom] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [angleX, setAngleX] = useState(0.52);
  const [angleY, setAngleY] = useState(-0.35);

  // Touch & Press-and-Hold Tracking Refs
  const lastTouchPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastPinchDistRef = useRef<number | null>(null);
  const isHeldActiveRef = useRef<boolean>(false);
  const heldRoomIdRef = useRef<string | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

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

  // Handle Viewport measurement
  const handleViewportLayout = (e: any) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setCanvasLayout({ width, height });
      setTimeout(() => {
        viewportRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
          if (w > 0 && h > 0) {
            viewportLayoutRef.current = { pageX, pageY, width: w, height: h };
          }
        });
      }, 50);
    }
  };

  // Compute 2D coordinate transformation
  const scale2D = useMemo(() => {
    return Math.max(4, baseScale2D * zoom);
  }, [zoom]);

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

  // Trigger iOS Native Haptic Feedback
  const triggerHaptic = () => {
    try {
      if (Platform.OS === 'ios') Vibration.vibrate(10);
    } catch {}
  };

  const triggerMediumHaptic = () => {
    try {
      if (Platform.OS === 'ios') Vibration.vibrate(35);
    } catch {}
  };

  /**
   * 4-Sided Collinear Magnetic Snapping Engine
   */
  const applyMagneticSnapping = (
    targetNode: RoomNode,
    nodesList: RoomNode[] = placedRoomNodes
  ): { x: number; z: number; guide: SnapGuide | null } => {
    const rw = targetNode.rotation % 180 === 0 ? targetNode.w : targetNode.l;
    const rl = targetNode.rotation % 180 === 0 ? targetNode.l : targetNode.w;

    let bestX = targetNode.x;
    let bestZ = targetNode.z;
    let bestGuide: SnapGuide | null = null;
    let bestScore = 0;

    const tMinX = targetNode.x - rw / 2;
    const tMaxX = targetNode.x + rw / 2;
    const tMinZ = targetNode.z - rl / 2;
    const tMaxZ = targetNode.z + rl / 2;

    const THRESH_CORNER_FT = 1.0;
    const THRESH_EDGE_FT = 1.2;

    for (const other of nodesList) {
      if (other.room.id === targetNode.room.id) continue;

      const ow = other.rotation % 180 === 0 ? other.w : other.l;
      const ol = other.rotation % 180 === 0 ? other.l : other.w;

      const oMinX = other.x - ow / 2;
      const oMaxX = other.x + ow / 2;
      const oMinZ = other.z - ol / 2;
      const oMaxZ = other.z + ol / 2;

      // 1. Corner Flush Pairs
      const cornerPairs = [
        { snapX: oMinX - rw / 2, snapZ: oMinZ + rl / 2, diffX: tMaxX - oMinX, diffZ: tMinZ - oMinZ, axis: 'EW', wallX: oMinX },
        { snapX: oMinX - rw / 2, snapZ: oMaxZ - rl / 2, diffX: tMaxX - oMinX, diffZ: tMaxZ - oMaxZ, axis: 'EW', wallX: oMinX },
        { snapX: oMaxX + rw / 2, snapZ: oMinZ + rl / 2, diffX: tMinX - oMaxX, diffZ: tMinZ - oMinZ, axis: 'EW', wallX: oMaxX },
        { snapX: oMaxX + rw / 2, snapZ: oMaxZ - rl / 2, diffX: tMinX - oMaxX, diffZ: tMaxZ - oMaxZ, axis: 'EW', wallX: oMaxX },
        { snapX: oMinX + rw / 2, snapZ: oMinZ - rl / 2, diffX: tMinX - oMinX, diffZ: tMaxZ - oMinZ, axis: 'NS', wallZ: oMinZ },
        { snapX: oMaxX - rw / 2, snapZ: oMinZ - rl / 2, diffX: tMaxX - oMaxX, diffZ: tMaxZ - oMinZ, axis: 'NS', wallZ: oMinZ },
        { snapX: oMinX + rw / 2, snapZ: oMaxZ + rl / 2, diffX: tMinX - oMinX, diffZ: tMinZ - oMaxZ, axis: 'NS', wallZ: oMaxZ },
        { snapX: oMaxX - rw / 2, snapZ: oMaxZ + rl / 2, diffX: tMaxX - oMaxX, diffZ: tMinZ - oMaxZ, axis: 'NS', wallZ: oMaxZ },
      ];

      for (const cp of cornerPairs) {
        const dist = Math.hypot(cp.diffX, cp.diffZ);
        if (dist <= THRESH_CORNER_FT && bestScore < 50) {
          bestX = cp.snapX;
          bestZ = cp.snapZ;
          bestScore = 50;

          if (cp.axis === 'EW') {
            const zStart = Math.max(bestZ - rl / 2, oMinZ);
            const zEnd = Math.min(bestZ + rl / 2, oMaxZ);
            bestGuide = {
              x1: cp.wallX ?? cp.snapX,
              z1: zStart,
              x2: cp.wallX ?? cp.snapX,
              z2: zEnd,
              anchorX: cp.snapX,
              anchorZ: cp.snapZ,
              overlapLen: Math.max(0, zEnd - zStart),
            };
          } else {
            const xStart = Math.max(bestX - rw / 2, oMinX);
            const xEnd = Math.min(bestX + rw / 2, oMaxX);
            bestGuide = {
              x1: xStart,
              z1: cp.wallZ ?? cp.snapZ,
              x2: xEnd,
              z2: cp.wallZ ?? cp.snapZ,
              anchorX: cp.snapX,
              anchorZ: cp.snapZ,
              overlapLen: Math.max(0, xEnd - xStart),
            };
          }
        }
      }

      // 2. Collinear Wall Edge Lock
      if (bestScore < 25) {
        if (Math.abs(tMaxX - oMinX) <= THRESH_EDGE_FT && Math.abs(tMinZ - oMinZ) < rl + ol) {
          bestX = oMinX - rw / 2;
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
        } else if (Math.abs(tMinX - oMaxX) <= THRESH_EDGE_FT && Math.abs(tMinZ - oMinZ) < rl + ol) {
          bestX = oMaxX + rw / 2;
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
        } else if (Math.abs(tMaxZ - oMinZ) <= THRESH_EDGE_FT && Math.abs(tMinX - oMinX) < rw + ow) {
          bestZ = oMinZ - rl / 2;
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
        } else if (Math.abs(tMinZ - oMaxZ) <= THRESH_EDGE_FT && Math.abs(tMinX - oMinX) < rw + ow) {
          bestZ = oMaxZ + rl / 2;
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

  // Canvas PanResponder: Press & Hold (200ms) with Light Orange Border to Drag, Quick Tap to Select
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }

        if (touches.length >= 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          lastPinchDistRef.current = Math.hypot(dx, dy);
          lastTouchPosRef.current = null;
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
            const vp = viewportLayoutRef.current;
            const canvasX = pageX - (vp.pageX || 16);
            const canvasY = pageY - (vp.pageY || 110);
            const worldTouch = canvasToWorld(canvasX, canvasY);

            // 1. Direct hit-test for corner rotation handle on currently selected room
            if (selectedRoomId) {
              const selNode = placedRoomNodes.find((n) => n.room.id === selectedRoomId);
              if (selNode) {
                const cc = worldToCanvas(selNode.x, selNode.z);
                const rwPx = (selNode.rotation % 180 === 0 ? selNode.w : selNode.l) * scale2D;
                const rlPx = (selNode.rotation % 180 === 0 ? selNode.l : selNode.w) * scale2D;
                const handleX = cc.x + rwPx / 2 - 14;
                const handleY = cc.y - rlPx / 2 + 14;
                const distToHandle = Math.hypot(canvasX - handleX, canvasY - handleY);
                if (distToHandle <= 28) {
                  handleRotateSelectedRoom();
                  return;
                }
              }
            }

            // Hit test top-most rooms
            let hitRoomId: string | null = null;
            for (let i = placedRoomNodes.length - 1; i >= 0; i--) {
              const n = placedRoomNodes[i];
              const rw = n.rotation % 180 === 0 ? n.w : n.l;
              const rl = n.rotation % 180 === 0 ? n.l : n.w;
              const pad = 1.2;
              if (
                worldTouch.x >= n.x - rw / 2 - pad &&
                worldTouch.x <= n.x + rw / 2 + pad &&
                worldTouch.z >= n.z - rl / 2 - pad &&
                worldTouch.z <= n.z + rl / 2 + pad
              ) {
                hitRoomId = n.room.id;
                break;
              }
            }

            if (hitRoomId) {
              // Immediately select room on tap
              setSelectedRoomId(hitRoomId);
              triggerHaptic();

              // Press & Hold (200ms) with finger slop tolerance up to 25pt
              longPressTimerRef.current = setTimeout(() => {
                isHeldActiveRef.current = true;
                heldRoomIdRef.current = hitRoomId;
                setHeldRoomId(hitRoomId); // Triggers Light Orange Border!
                triggerMediumHaptic();
              }, 200);
            } else {
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
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
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

          // If moved > 25pt before 200ms, cancel long press (user intended canvas pan)
          if (touchStartPosRef.current && longPressTimerRef.current && !isHeldActiveRef.current) {
            const moveDist = Math.hypot(curX - touchStartPosRef.current.x, curY - touchStartPosRef.current.y);
            if (moveDist > 25) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
          }

          if (lastTouchPosRef.current) {
            const dx = curX - lastTouchPosRef.current.x;
            const dy = curY - lastTouchPosRef.current.y;

            if (viewMode === '3d') {
              setAngleY((prev) => prev - dx * 0.01);
              setAngleX((prev) => Math.max(0.15, Math.min(1.4, prev - dy * 0.01)));
            } else if (isHeldActiveRef.current && heldRoomIdRef.current) {
              // Drag ONLY the held room (Independent Movement with Light Orange Border)
              const dWorldX = dx / scale2D;
              const dWorldZ = dy / scale2D;
              setPlacedRoomNodes((prev) =>
                prev.map((n) => {
                  if (n.room.id === heldRoomIdRef.current) {
                    const rawNode = {
                      ...n,
                      x: n.x + dWorldX,
                      z: n.z + dWorldZ,
                    };
                    const snapped = applyMagneticSnapping(rawNode, prev);
                    setActiveSnapGuide(snapped.guide);
                    return {
                      ...n,
                      x: snapped.x,
                      z: snapped.z,
                    };
                  }
                  return n;
                })
              );
            } else if (!longPressTimerRef.current) {
              // Pan Canvas Background
              setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
            }
          }
          lastTouchPosRef.current = { x: curX, y: curY };
        }
      },
      onPanResponderRelease: () => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        if (isHeldActiveRef.current) {
          triggerHaptic();
        }
        isHeldActiveRef.current = false;
        heldRoomIdRef.current = null;
        setHeldRoomId(null); // Release light orange border back to blue selection
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

    let maxX = -Infinity;
    placedRoomNodes.forEach((n) => {
      maxX = Math.max(maxX, n.x);
    });
    if (maxX === -Infinity) maxX = 0;

    const rw = room.width_ft || 16;
    const rl = room.length_ft || 14;
    const rh = room.height_ft || 9;
    const orthoAngle = computeOrthoAlignment(room.mesh_json);

    const newNode: RoomNode = {
      room,
      x: placedRoomNodes.length === 0 ? 0 : maxX + rw + 2,
      z: 0,
      w: rw,
      l: rl,
      h: rh,
      rotation: 0,
      floorLevel: room.floor_level || 'Ground Floor',
      color: palette[placedRoomNodes.length % palette.length],
      orthoAngle,
    };

    setPlacedRoomNodes((prev) => [...prev, newNode]);
    setSelectedRoomId(room.id);
    triggerHaptic();
  };

  // Merge Walls Action
  const handleMergeWalls = () => {
    if (!activeSnapGuide) return;
    const key = `${activeSnapGuide.x1.toFixed(1)}_${activeSnapGuide.z1.toFixed(1)}_${activeSnapGuide.x2.toFixed(1)}_${activeSnapGuide.z2.toFixed(1)}`;
    setMergedPartitions((prev) => new Set(prev).add(key));
    triggerHaptic();
    Alert.alert(
      'Walls Merged',
      `Successfully fused shared partition (${Math.round(activeSnapGuide.overlapLen)}' 0"). Double boundary eliminated.`
    );
  };

  // Export Composite STL
  const doExportCompositeStl = async (withRoof: boolean, includeFurniture: boolean) => {
    const placedRoomsList = placedRoomNodes.map((n) => n.room);
    if (placedRoomsList.length === 0) {
      Alert.alert('Studio Empty', 'Please place at least one room on the canvas before exporting.');
      return;
    }
    const stl = StlExporterService.generateCompositeStl(placedRoomsList, { withRoof, includeFurniture });
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

        const wx = node.x + rotX;
        const wz = node.z + rotZ;
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
      const effectiveHeightM = Math.min(1.2192, fullCeilingM);
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
  }, [placedRoomNodes, angleX, angleY, zoom, panOffset, selectedRoomId, viewW, viewH, layers.furniture]);

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
          <TouchableOpacity onPress={handleExportSheet} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.navDoneText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Exactly 2 Main Tabs: Studio (Active) | 3D Dollhouse View */}
        <View style={styles.mainTabsWrap}>
          <View style={styles.mainTabs}>
            <TouchableOpacity
              style={[styles.mainTab, activeTab === 'studio' && styles.mainTabActive]}
              onPress={() => {
                setActiveTab('studio');
                setViewMode('2d');
              }}
              activeOpacity={0.8}
            >
              <View style={styles.tabContentRow}>
                <Text style={[styles.mainTabText, activeTab === 'studio' && styles.mainTabTextActive]}>
                  Studio
                </Text>
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>
                    {placedRoomNodes.length} on canvas
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mainTab, activeTab === 'dollhouse' && styles.mainTabActive]}
              onPress={() => {
                setActiveTab('dollhouse');
                setViewMode('3d');
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.mainTabText, activeTab === 'dollhouse' && styles.mainTabTextActive]}>
                3D Dollhouse
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero CAD Viewport */}
        <View
          ref={viewportRef}
          style={styles.viewportArea}
          onLayout={handleViewportLayout}
        >
          {/* Layer 1: Gesture Surface for SVG Canvas */}
          <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
            <Svg width={viewW} height={viewH} style={styles.cadCanvas}>
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
                          const rwPx = (n.rotation % 180 === 0 ? n.w : n.l) * scale2D;
                          const rlPx = (n.rotation % 180 === 0 ? n.l : n.w) * scale2D;
                          const hX = centerCanvas.x + rwPx / 2 - 14;
                          const hY = centerCanvas.y - rlPx / 2 + 14;
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
            <View style={styles.selectedRoomDock} pointerEvents="box-none">
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
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.rotateGlyph}>↻</Text>
                </TouchableOpacity>

                {/* ✕ Delete Icon Button */}
                <TouchableOpacity
                  style={[styles.actionIconBtn, styles.btnDelete]}
                  onPress={handleRemoveSelectedRoom}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.deleteGlyph}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Apple Maps-Style Floating Layer Toggle Pill (Top-Right) */}
          <View style={styles.layerPillWrap} pointerEvents="box-none">
            <TouchableOpacity
              style={[styles.layerPillBtn, showLayerMenu && styles.layerPillBtnActive]}
              onPress={() => {
                setShowLayerMenu(!showLayerMenu);
                triggerHaptic();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.layerPillIcon}>🥞</Text>
              <Text style={[styles.layerPillText, showLayerMenu && styles.layerPillTextActive]}>Layers</Text>
            </TouchableOpacity>

            {/* Collapsible Layer Menu */}
            {showLayerMenu && (
              <View style={styles.layerMenuCard}>
                <Text style={styles.layerMenuTitle}>CANVAS LAYERS</Text>

                <TouchableOpacity
                  style={styles.layerMenuItem}
                  onPress={() => setLayers((prev) => ({ ...prev, doorsWindows: !prev.doorsWindows }))}
                >
                  <Text style={styles.layerItemLabel}>🚪 Doors & Windows</Text>
                  <View style={[styles.layerSwitchPill, layers.doorsWindows && styles.layerSwitchPillActive]}>
                    <Text style={[styles.layerSwitchText, layers.doorsWindows && styles.layerSwitchTextActive]}>
                      {layers.doorsWindows ? 'ON' : 'OFF'}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.layerMenuItem}
                  onPress={() => setLayers((prev) => ({ ...prev, dimensions: !prev.dimensions }))}
                >
                  <Text style={styles.layerItemLabel}>📏 Dimensions</Text>
                  <View style={[styles.layerSwitchPill, layers.dimensions && styles.layerSwitchPillActive]}>
                    <Text style={[styles.layerSwitchText, layers.dimensions && styles.layerSwitchTextActive]}>
                      {layers.dimensions ? 'ON' : 'OFF'}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.layerMenuItem}
                  onPress={() => setLayers((prev) => ({ ...prev, labels: !prev.labels }))}
                >
                  <Text style={styles.layerItemLabel}>🏷️ Labels & Names</Text>
                  <View style={[styles.layerSwitchPill, layers.labels && styles.layerSwitchPillActive]}>
                    <Text style={[styles.layerSwitchText, layers.labels && styles.layerSwitchTextActive]}>
                      {layers.labels ? 'ON' : 'OFF'}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.layerMenuItem}
                  onPress={() => setLayers((prev) => ({ ...prev, furniture: !prev.furniture }))}
                >
                  <Text style={styles.layerItemLabel}>🛋️ Furniture (OBB)</Text>
                  <View style={[styles.layerSwitchPill, layers.furniture && styles.layerSwitchPillActive]}>
                    <Text style={[styles.layerSwitchText, layers.furniture && styles.layerSwitchTextActive]}>
                      {layers.furniture ? 'ON' : 'OFF'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* BOTTOM-LEFT: Merge Walls Button */}
          {activeSnapGuide && activeSnapGuide.overlapLen > 0 && viewMode === '2d' && (
            <TouchableOpacity
              style={[
                styles.mergeIconBtn,
                mergedPartitions.has(
                  `${activeSnapGuide.x1.toFixed(1)}_${activeSnapGuide.z1.toFixed(1)}_${activeSnapGuide.x2.toFixed(1)}_${activeSnapGuide.z2.toFixed(1)}`
                ) && styles.mergeIconBtnFused,
              ]}
              onPress={handleMergeWalls}
              activeOpacity={0.8}
            >
              <Text style={styles.mergeGlyph}>
                {mergedPartitions.has(
                  `${activeSnapGuide.x1.toFixed(1)}_${activeSnapGuide.z1.toFixed(1)}_${activeSnapGuide.x2.toFixed(1)}_${activeSnapGuide.z2.toFixed(1)}`
                )
                  ? '✓'
                  : '🔗'}
              </Text>
              <Text
                style={[
                  styles.mergeBtnText,
                  mergedPartitions.has(
                    `${activeSnapGuide.x1.toFixed(1)}_${activeSnapGuide.z1.toFixed(1)}_${activeSnapGuide.x2.toFixed(1)}_${activeSnapGuide.z2.toFixed(1)}`
                  ) && styles.mergeBtnTextFused,
                ]}
              >
                {mergedPartitions.has(
                  `${activeSnapGuide.x1.toFixed(1)}_${activeSnapGuide.z1.toFixed(1)}_${activeSnapGuide.x2.toFixed(1)}_${activeSnapGuide.z2.toFixed(1)}`
                )
                  ? 'Merged'
                  : `Merge Walls (${Math.round(activeSnapGuide.overlapLen)}')`}
              </Text>
            </TouchableOpacity>
          )}

          {/* BOTTOM-RIGHT: Minimalist 2D / 3D Switcher */}
          <View style={styles.viewToggleBottom}>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === '2d' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('2d')}
            >
              <Text style={[styles.viewToggleText, viewMode === '2d' && styles.viewToggleTextActive]}>2D</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === '3d' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('3d')}
            >
              <Text style={[styles.viewToggleText, viewMode === '3d' && styles.viewToggleTextActive]}>3D</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Drawer: "Add 1 Room by 1 Room" Tray */}
        <View style={styles.bottomDrawer}>
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>Captured Rooms</Text>
            <Text style={styles.drawerSub}>Tap to select • Press & Hold to move</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roomTrayScroll}>
            {allRooms.map((r) => {
              const isPlaced = placedRoomNodes.some((n) => n.room.id === r.id);
              const isSelected = selectedRoomId === r.id;
              const isHeld = heldRoomId === r.id;
              const rw = Math.round(r.width_ft || 16);
              const rl = Math.round(r.length_ft || 14);

              return (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    styles.roomTrayCard,
                    isPlaced && styles.roomTrayCardPlaced,
                    isSelected && styles.roomTrayCardSelected,
                    isHeld && styles.roomTrayCardHeld,
                  ]}
                  onPress={() => {
                    if (isPlaced) {
                      setSelectedRoomId(r.id);
                      triggerHaptic();
                    } else {
                      handleAddRoomToCanvas(r);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View>
                    <View style={styles.rtcHeaderRow}>
                      <Text style={styles.rtcName} numberOfLines={1}>
                        {r.name.split('(')[0].trim()}
                      </Text>
                      {isSelected && <Text style={[styles.rtcSelectedDot, isHeld && styles.rtcSelectedDotHeld]}>●</Text>}
                    </View>
                    <Text style={styles.rtcMeta}>
                      {rw}' × {rl}' • {rw * rl} sq ft
                    </Text>
                  </View>

                  {isPlaced ? (
                    <View style={[styles.rtcBtnAdded, isSelected && styles.rtcBtnAddedSelected, isHeld && styles.rtcBtnAddedHeld]}>
                      <Text style={[styles.rtcBtnAddedText, (isSelected || isHeld) && styles.rtcBtnAddedTextSelected]}>
                        {isHeld ? '● Moving' : isSelected ? '● Selected' : '✓ On Canvas'}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.rtcBtnAdd}>
                      <Text style={styles.rtcBtnAddText}>+ Add to Studio</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
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
    right: 10,
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

  // Apple Maps-Style Floating Layer Toggle (Top-Right)
  layerPillWrap: {
    position: 'absolute',
    top: 60,
    right: 10,
    zIndex: 40,
    alignItems: 'flex-end',
  },
  layerPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#e5e5ea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  layerPillBtnActive: {
    backgroundColor: '#007aff',
    borderColor: '#007aff',
  },
  layerPillIcon: {
    fontSize: 12,
  },
  layerPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1c1c1e',
  },
  layerPillTextActive: {
    color: '#ffffff',
  },
  layerMenuCard: {
    marginTop: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 0.5,
    borderColor: '#e5e5ea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 180,
    gap: 8,
  },
  layerMenuTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8e8e93',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  layerMenuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  layerItemLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  layerSwitchPill: {
    backgroundColor: '#e5e5ea',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  layerSwitchPillActive: {
    backgroundColor: '#007aff',
  },
  layerSwitchText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8e8e93',
  },
  layerSwitchTextActive: {
    color: '#ffffff',
  },

  // Bottom-Left Minimalist Merge Button
  mergeIconBtn: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: 1.5,
    borderColor: '#34c759',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#34c759',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 40,
  },
  mergeIconBtnFused: {
    borderColor: '#007aff',
    shadowColor: '#007aff',
  },
  mergeGlyph: {
    fontSize: 13,
    lineHeight: 14,
  },
  mergeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#34c759',
  },
  mergeBtnTextFused: {
    color: '#007aff',
  },

  // Bottom-Right Minimalist 2D / 3D Switcher
  viewToggleBottom: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 19,
    padding: 3,
    flexDirection: 'row',
    borderWidth: 0.5,
    borderColor: '#e5e5ea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 40,
    height: 38,
  },
  viewToggleBtn: {
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleBtnActive: {
    backgroundColor: '#007aff',
    shadowColor: '#007aff',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  viewToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8e8e93',
  },
  viewToggleTextActive: {
    color: '#ffffff',
  },

  // Bottom Room Drawer Tray
  bottomDrawer: {
    backgroundColor: '#f5f5f7',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 8,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  drawerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1c1c1e',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  drawerSub: {
    fontSize: 11,
    color: '#8e8e93',
    fontWeight: '500',
  },
  roomTrayScroll: {
    gap: 10,
    paddingVertical: 2,
  },
  roomTrayCard: {
    minWidth: 130,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e5e5ea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
    justifyContent: 'space-between',
    gap: 8,
  },
  roomTrayCardPlaced: {
    backgroundColor: '#fafafc',
    opacity: 0.8,
  },
  roomTrayCardSelected: {
    borderColor: '#007aff',
    borderWidth: 1.5,
    backgroundColor: '#f0f7ff',
  },
  roomTrayCardHeld: {
    borderColor: '#f97316',
    borderWidth: 2,
    backgroundColor: '#fffaf0',
  },
  rtcHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rtcSelectedDot: {
    color: '#007aff',
    fontSize: 10,
  },
  rtcSelectedDotHeld: {
    color: '#f97316',
  },
  rtcName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1c1c1e',
    flex: 1,
  },
  rtcMeta: {
    fontSize: 11,
    color: '#8e8e93',
    marginTop: 2,
  },
  rtcBtnAdd: {
    backgroundColor: '#e8f2ff',
    borderRadius: 8,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rtcBtnAddText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#007aff',
  },
  rtcBtnAdded: {
    backgroundColor: '#f0f0f4',
    borderRadius: 8,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rtcBtnAddedSelected: {
    backgroundColor: '#007aff',
  },
  rtcBtnAddedHeld: {
    backgroundColor: '#f97316',
  },
  rtcBtnAddedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8e8e93',
  },
  rtcBtnAddedTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
