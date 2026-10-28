// sandbox/src/screens/LidarScannerScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  PanResponder,
  ScrollView,
  Alert,
  NativeModules,
  Platform,
} from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import { Room } from '../types/room';
import { Database } from '../db/database';
import {
  ScannerService,
  ScanSimulationState,
  ROOM_PRESETS,
  RoomCategory,
} from '../services/scannerService';
import { GeometryService } from '../services/geometryService';

interface Props {
  onBack: () => void;
  onScanFinished: (savedRoom: Room) => void;
}

export const LidarScannerScreen: React.FC<Props> = ({
  onBack,
  onScanFinished,
}) => {
  const [scanState, setScanState] = useState<ScanSimulationState>(
    ScannerService.createInitialScan('Living Room')
  );
  const [angleX, setAngleX] = useState(0.4);
  const [angleY, setAngleY] = useState(-0.5);

  // Touch pan responder for 360 orbit
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gestureState) => {
      setAngleY((prev) => prev + gestureState.dx * 0.0005);
      setAngleX((prev) => prev + gestureState.dy * 0.0005);
    },
  });

  // Dynamic point streaming when scanning
  useEffect(() => {
    if (!scanState.isScanning) return;

    const interval = setInterval(() => {
      setScanState((prev) => {
        const nextCount = prev.pointCount + Math.floor(Math.random() * 90 + 50);

        let phase = prev.scanPhase;
        if (nextCount > 3000) {
          phase = 'complete';
        } else if (nextCount > 1000) {
          phase = 'walls';
        } else {
          phase = 'floor';
        }

        const updatedPoints = ScannerService.generatePointBatch(
          prev.points,
          phase,
          prev.widthFt,
          prev.lengthFt
        );

        return {
          ...prev,
          pointCount: nextCount,
          scanPhase: phase,
          points: updatedPoints,
        };
      });
    }, 180);

    return () => clearInterval(interval);
  }, [scanState.isScanning, scanState.widthFt, scanState.lengthFt]);

  const handleSelectCategory = (category: RoomCategory) => {
    setScanState((prev) => ScannerService.applyPreset(prev, category));
  };

  const handleAdjustDimension = (dim: 'width' | 'length', delta: number) => {
    setScanState((prev) => {
      const nextW = dim === 'width' ? Math.max(5, +(prev.widthFt + delta).toFixed(1)) : prev.widthFt;
      const nextL = dim === 'length' ? Math.max(5, +(prev.lengthFt + delta).toFixed(1)) : prev.lengthFt;
      return {
        ...prev,
        widthFt: nextW,
        lengthFt: nextL,
        areaSqFt: +(nextW * nextL).toFixed(1),
      };
    });
  };

  const handleStartScan = async () => {
    const { RoomPlanModule } = NativeModules;
    if (Platform.OS === 'ios' && RoomPlanModule) {
      try {
        const supported = await RoomPlanModule.isSupported();
        if (supported) {
          // Launch real native Apple RoomPlan camera session
          const result = await RoomPlanModule.startRoomScan();
          if (result && result.isRealLiDAR) {
            const floorPrefix = result.floorLevel && result.floorLevel !== 'Ground Floor'
              ? `${result.floorLevel} - `
              : '';
            const room: Room = {
              id: 'room-' + Date.now(),
              name: `${floorPrefix}${scanState.selectedCategory} (${GeometryService.formatFeetInches(result.lengthFt)} × ${GeometryService.formatFeetInches(result.widthFt)})`,
              length_ft: result.lengthFt,
              width_ft: result.widthFt,
              height_ft: result.heightFt,
              area_sqft: result.areaSqFt,
              mesh_json: JSON.stringify(result),
              floor_level: result.floorLevel || 'Ground Floor',
              elevation_ft: result.elevationFt ?? 0,
              is_sample: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            await Database.saveRoom(room);
            Alert.alert(
              'LiDAR Scan Complete',
              `Measured Physical Room:\n${GeometryService.formatFeetInches(room.length_ft)} × ${GeometryService.formatFeetInches(room.width_ft)} × ${GeometryService.formatFeetInches(room.height_ft)} (${room.area_sqft} sq ft)\nFloor: ${room.floor_level}\nWalls: ${result.wallCount}, Doors: ${result.doorCount}`,
              [
                {
                  text: 'View in 3D Studio',
                  onPress: () => onScanFinished(room),
                },
              ]
            );
            return;
          }
        }
      } catch (e: any) {
        if (e?.code === 'CANCELLED') {
          return;
        }
        console.warn('Native RoomPlan error, falling back:', e);
      }
    }

    // Fallback if hardware LiDAR is not available
    setScanState((prev) => ({
      ...prev,
      isScanning: true,
      scanPhase: 'floor',
      pointCount: 160,
      points: ScannerService.generatePointBatch([], 'floor', prev.widthFt, prev.lengthFt),
    }));
  };

  const handleToggleScan = () => {
    setScanState((prev) => ({
      ...prev,
      isScanning: !prev.isScanning,
    }));
  };

  const handleResetScan = () => {
    setScanState(ScannerService.createInitialScan(scanState.selectedCategory));
  };

  const handleFinishScan = async () => {
    if (scanState.pointCount < 200) {
      Alert.alert(
        'Scan Incomplete',
        'Please capture at least 200 LiDAR points to construct a watertight room mesh.'
      );
      return;
    }

    const room = ScannerService.finishScan(scanState);
    await Database.saveRoom(room);
    Alert.alert(
      'Room Saved',
      `"${room.name}" saved:\n${GeometryService.formatFeetInches(room.length_ft)} × ${GeometryService.formatFeetInches(room.width_ft)} (${room.area_sqft} sq ft).`,
      [
        {
          text: 'Open in Studio',
          onPress: () => onScanFinished(room),
        },
      ]
    );
  };

  // 3D wireframe box calculation based on current room dimensions
  const scaleW = scanState.widthFt * 6;
  const scaleL = scanState.lengthFt * 6;
  const scaleH = scanState.heightFt * 6;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#eef2f7" />
      <View style={styles.container}>
        {/* Top HUD */}
        <View style={styles.topHud}>
          <TouchableOpacity style={styles.hudPill} onPress={onBack}>
            <Text style={styles.hudPillText}>‹ Rooms</Text>
          </TouchableOpacity>

          <View style={styles.hudPill}>
            <View
              style={[
                styles.statusDot,
                scanState.isScanning
                  ? styles.dotScanning
                  : scanState.pointCount > 0
                  ? styles.dotPaused
                  : styles.dotIdle,
              ]}
            />
            <Text style={styles.hudPillText}>
              {scanState.isScanning
                ? 'LiDAR Scanning (60 Hz)'
                : scanState.pointCount > 0
                ? 'Scan Paused'
                : 'Sensor Ready (0 pts)'}
            </Text>
          </View>

          <View style={styles.hudPill}>
            <Text style={styles.hudPillText}>Units: ft</Text>
          </View>
        </View>

        {/* Room Preset Selector */}
        <View style={styles.presetBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetScroll}
          >
            {ROOM_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.category}
                style={[
                  styles.presetChip,
                  scanState.selectedCategory === preset.category && styles.presetChipActive,
                ]}
                onPress={() => handleSelectCategory(preset.category)}
              >
                <Text style={styles.presetIcon}>{preset.icon}</Text>
                <Text
                  style={[
                    styles.presetLabel,
                    scanState.selectedCategory === preset.category && styles.presetLabelActive,
                  ]}
                >
                  {preset.category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Viewport Area */}
        <View style={styles.viewport} {...panResponder.panHandlers}>
          <Svg style={StyleSheet.absoluteFill}>
            {/* Ground grid */}
            {[-80, -40, 0, 40, 80].map((coord, idx) => {
              const p1 = GeometryService.project3D(coord, 60, -80, angleX, angleY, 340, 360);
              const p2 = GeometryService.project3D(coord, 60, 80, angleX, angleY, 340, 360);
              return (
                <Line
                  key={`grid-x-${idx}`}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={scanState.pointCount > 0 ? 'rgba(0, 122, 255, 0.25)' : 'rgba(0, 0, 0, 0.08)'}
                  strokeWidth="1"
                />
              );
            })}

            {/* Wireframe box dynamically projected from scaleW, scaleL, scaleH */}
            {scanState.scanPhase !== 'idle' && (() => {
              const halfW = scaleW / 2;
              const halfL = scaleL / 2;
              const halfH = scaleH / 2;

              const p1 = GeometryService.project3D(-halfW, 60, -halfL, angleX, angleY, 340, 360);
              const p2 = GeometryService.project3D(halfW, 60, -halfL, angleX, angleY, 340, 360);
              const p3 = GeometryService.project3D(halfW, 60, halfL, angleX, angleY, 340, 360);
              const p4 = GeometryService.project3D(-halfW, 60, halfL, angleX, angleY, 340, 360);

              const edges: [{ x: number; y: number }, { x: number; y: number }][] = [
                [p1, p2], [p2, p3], [p3, p4], [p4, p1],
              ];

              if (scanState.scanPhase === 'walls' || scanState.scanPhase === 'complete') {
                const t1 = GeometryService.project3D(-halfW, 60 - scaleH, -halfL, angleX, angleY, 340, 360);
                const t2 = GeometryService.project3D(halfW, 60 - scaleH, -halfL, angleX, angleY, 340, 360);
                const t3 = GeometryService.project3D(halfW, 60 - scaleH, halfL, angleX, angleY, 340, 360);
                const t4 = GeometryService.project3D(-halfW, 60 - scaleH, halfL, angleX, angleY, 340, 360);

                edges.push([p1, t1], [p2, t2], [p3, t3], [p4, t4]);

                if (scanState.scanPhase === 'complete') {
                  edges.push([t1, t2], [t2, t3], [t3, t4], [t4, t1]);
                }
              }

              return edges.map(([a, b], idx) => (
                <Line
                  key={`edge-${idx}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={scanState.scanPhase === 'complete' ? '#007aff' : '#34c759'}
                  strokeWidth="2"
                />
              ));
            })()}

            {/* Dynamic scatter points */}
            {scanState.points.map((pt, idx) => {
              const proj = GeometryService.project3D(pt.x, pt.y, pt.z, angleX, angleY, 340, 360);
              return (
                <Circle
                  key={`pt-${idx}`}
                  cx={proj.x}
                  cy={proj.y}
                  r={scanState.scanPhase === 'complete' ? 2 : 2.5}
                  fill={pt.col}
                />
              );
            })}
          </Svg>

          {/* Idle Targeting Guide (Initial Clean State) */}
          {scanState.scanPhase === 'idle' && (
            <View style={styles.idleOverlay} pointerEvents="box-none">
              <View style={styles.reticleBox}>
                <View style={[styles.cornerBracket, styles.bracketTL]} />
                <View style={[styles.cornerBracket, styles.bracketTR]} />
                <View style={[styles.cornerBracket, styles.bracketBL]} />
                <View style={[styles.cornerBracket, styles.bracketBR]} />
                <View style={styles.centerAimCross} />
              </View>
              <View style={styles.idleBadge}>
                <Text style={styles.idleTitle}>Scanning {scanState.selectedCategory}</Text>
                <Text style={styles.idleSubtitle}>
                  Point camera at corners and floor lines. Pan to rotate 3D view.
                </Text>
              </View>
            </View>
          )}

          {/* Floating Measurement Tags */}
          {scanState.scanPhase !== 'idle' && (
            <>
              <View style={[styles.floatingTag, { top: 160, left: 120 }]}>
                <Text style={styles.tagText}>
                  W: {GeometryService.formatFeetInches(scanState.widthFt)}
                </Text>
              </View>
              <View style={[styles.floatingTag, { top: 260, left: 200 }]}>
                <Text style={styles.tagText}>
                  L: {GeometryService.formatFeetInches(scanState.lengthFt)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Dimension Fine-Tuning Controls */}
        <View style={styles.tuningBar}>
          <View style={styles.tuningGroup}>
            <Text style={styles.tuningLabel}>Width:</Text>
            <TouchableOpacity
              style={styles.tuneBtn}
              onPress={() => handleAdjustDimension('width', -0.5)}
            >
              <Text style={styles.tuneBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.tuneVal}>
              {GeometryService.formatFeetInches(scanState.widthFt)}
            </Text>
            <TouchableOpacity
              style={styles.tuneBtn}
              onPress={() => handleAdjustDimension('width', 0.5)}
            >
              <Text style={styles.tuneBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tuningDivider} />

          <View style={styles.tuningGroup}>
            <Text style={styles.tuningLabel}>Length:</Text>
            <TouchableOpacity
              style={styles.tuneBtn}
              onPress={() => handleAdjustDimension('length', -0.5)}
            >
              <Text style={styles.tuneBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.tuneVal}>
              {GeometryService.formatFeetInches(scanState.lengthFt)}
            </Text>
            <TouchableOpacity
              style={styles.tuneBtn}
              onPress={() => handleAdjustDimension('length', 0.5)}
            >
              <Text style={styles.tuneBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Sheet Controls */}
        <View style={styles.bottomSheet}>
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>
                {scanState.pointCount.toLocaleString()}
              </Text>
              <Text style={styles.metricLabel}>LiDAR Points</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>
                {scanState.pointCount > 0 ? '±0.12 in' : '--'}
              </Text>
              <Text style={styles.metricLabel}>Accuracy</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{scanState.areaSqFt} sq ft</Text>
              <Text style={styles.metricLabel}>Floor Area</Text>
            </View>
          </View>

          {/* Action Buttons */}
          {scanState.scanPhase === 'idle' ? (
            <TouchableOpacity
              style={styles.primaryStartBtn}
              onPress={handleStartScan}
            >
              <Text style={styles.startBtnText}>⚡ Start LiDAR Scan</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.controlsRow}>
              <TouchableOpacity
                style={styles.secondaryCircleBtn}
                onPress={handleToggleScan}
                accessibilityLabel={scanState.isScanning ? 'Pause' : 'Resume'}
              >
                <Text style={styles.circleBtnIcon}>
                  {scanState.isScanning ? '⏸' : '▶'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryCircleBtn}
                onPress={handleResetScan}
                accessibilityLabel="Reset Scan"
              >
                <Text style={styles.circleBtnIcon}>🔄</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.primaryFinishBtn,
                  scanState.pointCount < 200 && styles.btnDisabled,
                ]}
                onPress={handleFinishScan}
              >
                <Text style={styles.finishBtnText}>⏹ Finish & Save Room</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#eef2f7',
  },
  container: {
    flex: 1,
    backgroundColor: '#eef2f7',
  },
  topHud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    zIndex: 10,
  },
  hudPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#e5e5ea',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotScanning: {
    backgroundColor: '#34c759',
  },
  dotPaused: {
    backgroundColor: '#ff9500',
  },
  dotIdle: {
    backgroundColor: '#8e8e93',
  },
  hudPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  presetBar: {
    paddingVertical: 8,
  },
  presetScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#e5e5ea',
  },
  presetChipActive: {
    backgroundColor: '#007aff',
    borderColor: '#007aff',
  },
  presetIcon: {
    fontSize: 12,
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  presetLabelActive: {
    color: '#ffffff',
  },
  viewport: {
    flex: 1,
    position: 'relative',
  },
  idleOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticleBox: {
    width: 170,
    height: 170,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cornerBracket: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: '#007aff',
  },
  bracketTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  bracketTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bracketBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bracketBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  centerAimCross: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#007aff',
  },
  idleBadge: {
    marginTop: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#e5e5ea',
  },
  idleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1c1c1e',
  },
  idleSubtitle: {
    fontSize: 11,
    color: '#636366',
    marginTop: 2,
    textAlign: 'center',
  },
  floatingTag: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e5ea',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#007aff',
  },
  tuningBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 0.5,
    borderColor: '#e5e5ea',
  },
  tuningGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tuningLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8e8e93',
  },
  tuningDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#e5e5ea',
  },
  tuneBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f5f5f7',
    borderWidth: 0.5,
    borderColor: '#e5e5ea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tuneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007aff',
  },
  tuneVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1c1c1e',
    minWidth: 48,
    textAlign: 'center',
  },
  bottomSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderColor: '#e5e5ea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1c1c1e',
  },
  metricLabel: {
    fontSize: 10,
    color: '#8e8e93',
    marginTop: 2,
  },
  primaryStartBtn: {
    backgroundColor: '#007aff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007aff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  startBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  secondaryCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f7',
    borderWidth: 1,
    borderColor: '#e5e5ea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtnIcon: {
    fontSize: 16,
  },
  primaryFinishBtn: {
    flex: 1,
    backgroundColor: '#34c759',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#34c759',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  finishBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  btnDisabled: {
    backgroundColor: '#a2a2a7',
    shadowOpacity: 0,
  },
});
