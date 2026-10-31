// sandbox/src/screens/RoomsCatalogScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import Svg, { Polygon, Line } from 'react-native-svg';
import { Room } from '../types/room';
import { Database } from '../db/database';
import { GeometryService } from '../services/geometryService';

const RoomBlueprintThumbnail: React.FC<{ room: Room; width?: number; height?: number }> = ({
  room,
  width = 100,
  height = 80,
}) => {
  let parsedMesh: any = null;
  try {
    if (room.mesh_json) parsedMesh = JSON.parse(room.mesh_json);
  } catch {}

  const realWalls: any[] = parsedMesh?.walls || [];
  const realDoors: any[] = parsedMesh?.doors || [];
  const realWindows: any[] = parsedMesh?.windows || [];
  const poly = GeometryService.buildRoomPolygon(realWalls, room.width_ft || 14, room.length_ft || 16);

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of poly) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const spanX = Math.max(2, maxX - minX);
  const spanZ = Math.max(2, maxZ - minZ);

  const pad = 10;
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanZ);
  const cx = width / 2 - ((minX + maxX) / 2) * scale;
  const cz = height / 2 - ((minZ + maxZ) / 2) * scale;

  const pointsStr = poly
    .map((p) => `${+(p.x * scale + cx).toFixed(1)},${+(p.z * scale + cz).toFixed(1)}`)
    .join(' ');

  return (
    <View style={styles.thumbnailContainer}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#e2e8f0"
          strokeWidth={0.75}
          strokeDasharray="3,3"
        />
        <Line
          x1={width / 2}
          y1={0}
          x2={width / 2}
          y2={height}
          stroke="#e2e8f0"
          strokeWidth={0.75}
          strokeDasharray="3,3"
        />
        <Polygon
          points={pointsStr}
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {realDoors.map((d: any, idx: number) => {
          const dx = (d.x ?? 0) * scale + cx;
          const dz = (d.z ?? 0) * scale + cz;
          return (
            <Line
              key={`d-${idx}`}
              x1={dx - 4}
              y1={dz}
              x2={dx + 4}
              y2={dz}
              stroke="#f59e0b"
              strokeWidth={3}
            />
          );
        })}
        {realWindows.map((w: any, idx: number) => {
          const wx = (w.x ?? 0) * scale + cx;
          const wz = (w.z ?? 0) * scale + cz;
          return (
            <Line
              key={`w-${idx}`}
              x1={wx - 4}
              y1={wz}
              x2={wx + 4}
              y2={wz}
              stroke="#06b6d4"
              strokeWidth={3}
            />
          );
        })}
      </Svg>
    </View>
  );
};

interface Props {
  onNavigateToScan: () => void;
  onSelectRoom: (room: Room) => void;
  onNavigateToSettings?: () => void;
}

export const RoomsCatalogScreen: React.FC<Props> = ({
  onNavigateToScan,
  onSelectRoom,
  onNavigateToSettings,
}) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const dbRooms = await Database.getRooms();
    setRooms(dbRooms);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRenameRoom = (room: Room) => {
    Alert.prompt(
      'Rename Room',
      'Enter new name for this room:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (newName?: string) => {
            const trimmed = newName?.trim();
            if (!trimmed) {
              Alert.alert('Invalid Name', 'Room name cannot be empty.');
              return;
            }
            const clamped = trimmed.slice(0, 40);
            const updated = {
              ...room,
              name: clamped,
              updated_at: new Date().toISOString(),
            };
            await Database.saveRoom(updated);
            await loadData();
          },
        },
      ],
      'plain-text',
      room.name
    );
  };

  const handleDeleteRoom = (room: Room) => {
    Alert.alert(
      'Delete Scanned Room',
      `Are you sure you want to permanently delete "${room.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await Database.deleteRoom(room.id);
            await loadData();
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All My Scans',
      `Delete all ${rooms.length} room scans? The catalog will return to its clean empty state.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            await Database.clearDatabase();
            await loadData();
          },
        },
      ]
    );
  };

  const displayedRooms = rooms;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f7" />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>LiDAR Studio</Text>
            <Text style={styles.headerSubtitle}>Apple HIG Light Mode Precision</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {onNavigateToSettings && (
              <TouchableOpacity
                style={styles.settingsHeaderBtn}
                onPress={onNavigateToSettings}
                accessibilityLabel="Open Settings"
              >
                <Text style={{ fontSize: 20 }}>⚙️</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.scanPrimaryPill}
              onPress={onNavigateToScan}
              accessibilityLabel="Start new scan"
            >
              <Text style={styles.scanPillText}>+ New Scan</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sub-header row for My Scans management */}
        {rooms.length > 0 && (
          <View style={styles.subActionsRow}>
            <Text style={styles.scansCountLabel}>
              {rooms.length} {rooms.length === 1 ? 'room captured' : 'rooms captured'}
            </Text>
            {rooms.length > 1 && (
              <TouchableOpacity onPress={handleClearAll}>
                <Text style={styles.clearAllText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Catalog Body */}
        {rooms.length === 0 ? (
          // First-Class Empty State
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIconText}>🧊</Text>
            </View>
            <Text style={styles.emptyTitle}>No Rooms Scanned Yet</Text>
            <Text style={styles.emptyDescription}>
              Point your iPhone camera at corners and floor lines. The LiDAR engine
              captures watertight 3D meshes with real-time measurements.
            </Text>
            <TouchableOpacity
              style={styles.emptyCtaBtn}
              onPress={onNavigateToScan}
            >
              <Text style={styles.emptyCtaText}>Start Your First Scan</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Populated Cards List
          <ScrollView
            style={styles.cardsScroll}
            contentContainerStyle={styles.cardsContent}
            showsVerticalScrollIndicator={false}
          >
            {displayedRooms.map((room) => (
              <View key={room.id} style={styles.roomCard}>
                <View style={styles.cardHeaderRow}>
                  <TouchableOpacity
                    style={styles.cardTitleWrap}
                    onPress={() => onSelectRoom(room)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cardRoomName}>{room.name}</Text>
                    {room.floor_level && (
                      <View
                        style={[
                          styles.floorBadge,
                          room.floor_level === 'Basement' && styles.floorBadgeBasement,
                        ]}
                      >
                        <Text
                          style={[
                            styles.floorBadgeText,
                            room.floor_level === 'Basement' && styles.floorBadgeTextBasement,
                          ]}
                        >
                          {room.floor_level === 'Basement' ? '🪜 Basement' : `🚪 ${room.floor_level}`}
                        </Text>
                      </View>
                    )}
                    {room.is_sample && (
                      <View style={styles.sampleBadge}>
                        <Text style={styles.sampleBadgeText}>Sample</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Action buttons on user scans */}
                  {!room.is_sample && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity
                        style={styles.renamePill}
                        onPress={() => handleRenameRoom(room)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={`Rename ${room.name}`}
                      >
                        <Text style={styles.renamePillText}>Rename</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deletePill}
                        onPress={() => handleDeleteRoom(room)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={`Delete ${room.name}`}
                      >
                        <Text style={styles.deletePillText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Body Row: 2D Floor Plan Blueprint Thumbnail + Key Metrics */}
                <TouchableOpacity
                  style={styles.cardBodyRow}
                  onPress={() => onSelectRoom(room)}
                  activeOpacity={0.8}
                >
                  <RoomBlueprintThumbnail room={room} width={100} height={80} />

                  <View style={styles.cardMetricsCol}>
                    <View style={styles.cardMetricItem}>
                      <Text style={styles.cardMetricValue}>
                        {GeometryService.formatFeetInches(room.length_ft)} ×{' '}
                        {GeometryService.formatFeetInches(room.width_ft)}
                      </Text>
                      <Text style={styles.cardMetricLabel}>Dimensions</Text>
                    </View>
                    <View style={styles.cardMetricsSubRow}>
                      <View style={styles.cardMetricItem}>
                        <Text style={styles.cardMetricValue}>
                          {GeometryService.formatAreaSqFt(room.area_sqft)}
                        </Text>
                        <Text style={styles.cardMetricLabel}>Floor Area</Text>
                      </View>
                      <View style={styles.cardMetricItem}>
                        <Text style={styles.cardMetricValue}>
                          {GeometryService.formatFeetInches(room.height_ft)}
                        </Text>
                        <Text style={styles.cardMetricLabel}>Ceiling</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
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
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1c1c1e',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#8e8e93',
    fontWeight: '500',
    marginTop: 2,
  },
  scanPrimaryPill: {
    backgroundColor: '#007aff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#007aff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  scanPillText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  segmentedControlWrap: {
    backgroundColor: 'rgba(118, 118, 128, 0.12)',
    borderRadius: 9,
    padding: 2,
    flexDirection: 'row',
    marginBottom: 12,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 7,
  },
  segmentBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8e8e93',
  },
  segmentTextActive: {
    color: '#1c1c1e',
  },
  subActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  scansCountLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8e8e93',
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ff3b30',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingBottom: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  emptyIconText: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1c1c1e',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyCtaBtn: {
    backgroundColor: '#007aff',
    height: 50,
    width: '100%',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007aff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  emptyCtaText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  previewSamplesLink: {
    marginTop: 18,
  },
  previewSamplesText: {
    color: '#007aff',
    fontSize: 14,
    fontWeight: '500',
  },
  cardsScroll: {
    flex: 1,
  },
  cardsContent: {
    paddingBottom: 110,
    gap: 12,
  },
  roomCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 0.5,
    borderColor: '#e5e5ea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cardRoomName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  settingsHeaderBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e5ea',
  },
  renamePill: {
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#bae6fd',
  },
  renamePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284c7',
  },
  deletePill: {
    backgroundColor: '#fff1f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#ffccc7',
  },
  deletePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ff3b30',
  },
  sampleBadge: {
    backgroundColor: '#eef2f7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sampleBadgeText: {
    fontSize: 11,
    color: '#007aff',
    fontWeight: '600',
  },
  floorBadge: {
    backgroundColor: '#f2f2f7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 6,
  },
  floorBadgeBasement: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  floorBadgeText: {
    color: '#636366',
    fontSize: 11,
    fontWeight: '600',
  },
  floorBadgeTextBasement: {
    color: '#ea580c',
  },
  thumbnailContainer: {
    width: 100,
    height: 80,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#f8fafd',
    borderRadius: 14,
    padding: 10,
    borderWidth: 0.5,
    borderColor: '#e2e8f0',
  },
  cardMetricsCol: {
    flex: 1,
    gap: 6,
  },
  cardMetricsSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 6,
  },
  cardMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafd',
    borderRadius: 12,
    padding: 10,
  },
  cardMetricItem: {
    alignItems: 'center',
  },
  cardMetricValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1c1c1e',
  },
  cardMetricLabel: {
    fontSize: 10,
    color: '#8e8e93',
    marginTop: 2,
    fontWeight: '500',
  },
});
