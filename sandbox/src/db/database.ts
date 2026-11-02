// sandbox/src/db/database.ts
import { NativeModules, Platform } from 'react-native';
import { Room, FurnitureItem, HouseProject, HouseBuild } from '../types/room';

// In-memory + persistent store (works cleanly across Expo Web, iOS native, and Node tests)
let inMemoryRooms: Room[] = [];
let inMemoryFurniture: FurnitureItem[] = [];
let inMemoryProjects: HouseProject[] = [];
let inMemoryBuilds: HouseBuild[] = [];
let hasLoadedFromDisk = false;
let loadPromise: Promise<void> | null = null;

async function ensureLoaded(): Promise<void> {
  if (hasLoadedFromDisk) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    if (Platform.OS === 'ios' && NativeModules?.RoomPlanModule?.getPersistedRooms) {
      try {
        const persisted = await NativeModules.RoomPlanModule.getPersistedRooms();
        if (Array.isArray(persisted) && persisted.length > 0) {
          for (const item of persisted) {
            if (item.isDeleted) continue; // Skip deleted items
            const rawId = item.id || (item.usdzPath ? 'room-' + item.usdzPath.split('_').pop()?.replace('.usdz', '') : 'room-' + Date.now());
            const roomId = String(rawId);
            if (!inMemoryRooms.some((r) => r.id === roomId)) {
              inMemoryRooms.push({
                id: roomId,
                name: item.roomName || 'Living Room',
                length_ft: item.lengthFt || 14.7,
                width_ft: item.widthFt || 14.1,
                height_ft: item.heightFt || 8.1,
                area_sqft: item.areaSqFt || 206.0,
                mesh_json: JSON.stringify(item),
                floor_level: item.floorLevel || 'Ground Floor',
                elevation_ft: item.elevationFt ?? 0,
                is_sample: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load persisted rooms from disk:', err);
      }
    } else {
      // Local Fast Loop: Hydrate from real device dump for Web / Node / Desktop development
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const bundled = require('../../data/device_dump/bundled_rooms.json');
        if (Array.isArray(bundled) && bundled.length > 0) {
          for (const item of bundled) {
            if (item.isDeleted) continue;
            const rawId = item.id || (item.usdzPath ? 'room-' + item.usdzPath.split('_').pop()?.replace('.usdz', '') : 'room-' + Date.now());
            const roomId = String(rawId);
            if (!inMemoryRooms.some((r) => r.id === roomId)) {
              inMemoryRooms.push({
                id: roomId,
                name: item.roomName || 'Living Room',
                length_ft: item.lengthFt || 14.7,
                width_ft: item.widthFt || 14.1,
                height_ft: item.heightFt || 8.1,
                area_sqft: item.areaSqFt || 206.0,
                mesh_json: JSON.stringify(item),
                floor_level: item.floorLevel || 'Ground Floor',
                elevation_ft: item.elevationFt ?? 0,
                is_sample: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
          }
        }
      } catch (e) {
        // Gracefully ignore if running in environment where bundled_rooms is omitted
      }
    }

    // Hydrate saved house builds from Web local storage if available
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('roomos_house_builds');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            inMemoryBuilds = parsed;
          }
        }
      } catch (err) {
        console.warn('Failed loading house builds from localStorage:', err);
      }
    }

    hasLoadedFromDisk = true;
    loadPromise = null;
  })();

  return loadPromise;
}

export const Database = {
  // Fresh installs start empty, automatically loads persisted scans from iOS disk
  async getRooms(includeSamples = false): Promise<Room[]> {
    await ensureLoaded();
    if (includeSamples) {
      return [...inMemoryRooms];
    }
    return inMemoryRooms.filter((r) => !r.is_sample);
  },

  async getRoomById(id: string): Promise<Room | null> {
    await this.getRooms(true);
    const room = inMemoryRooms.find((r) => r.id === id);
    return room || null;
  },

  async saveRoom(room: Room): Promise<void> {
    const idx = inMemoryRooms.findIndex((r) => r.id === room.id);
    if (idx >= 0) {
      inMemoryRooms[idx] = room;
    } else {
      inMemoryRooms.unshift(room);
    }

    if (Platform.OS === 'ios' && NativeModules?.RoomPlanModule?.saveRoomJson) {
      try {
        let payload = room.mesh_json ? JSON.parse(room.mesh_json) : {};
        payload.id = room.id;
        payload.roomName = room.name;
        payload.lengthFt = room.length_ft;
        payload.widthFt = room.width_ft;
        payload.heightFt = room.height_ft;
        payload.areaSqFt = room.area_sqft;
        payload.floorLevel = room.floor_level;
        payload.elevationFt = room.elevation_ft;
        await NativeModules.RoomPlanModule.saveRoomJson(room.id, JSON.stringify(payload, null, 2));
      } catch (e) {
        console.warn('Failed saving room json to disk:', e);
      }
    }
  },

  async deleteRoom(id: string): Promise<void> {
    inMemoryRooms = inMemoryRooms.filter((r) => r.id !== id);
    inMemoryFurniture = inMemoryFurniture.filter((f) => f.room_id !== id);
    // Cascade removal from house projects
    inMemoryProjects.forEach((proj) => {
      proj.room_ids = proj.room_ids.filter((rId) => rId !== id);
    });

    if (Platform.OS === 'ios' && NativeModules?.RoomPlanModule?.saveRoomJson) {
      try {
        const filename = id.startsWith('scanned_room_') ? id : `scanned_room_${id}`;
        await NativeModules.RoomPlanModule.saveRoomJson(
          filename,
          JSON.stringify({ id, isDeleted: true, deletedAt: new Date().toISOString() })
        );
      } catch (e) {
        console.warn('Failed marking room deleted on disk:', e);
      }
    }
  },

  async purgeAllData(): Promise<void> {
    const ids = inMemoryRooms.map((r) => r.id);
    inMemoryRooms = [];
    inMemoryFurniture = [];
    inMemoryProjects = [];
    inMemoryBuilds = [];
    hasLoadedFromDisk = true; // Lock cache so deleted rooms are never reloaded

    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('roomos_house_builds');
      } catch {}
    }

    if (Platform.OS === 'ios' && NativeModules?.RoomPlanModule?.saveRoomJson) {
      try {
        for (const id of ids) {
          const filename = id.startsWith('scanned_room_') ? id : `scanned_room_${id}`;
          await NativeModules.RoomPlanModule.saveRoomJson(
            filename,
            JSON.stringify({ id, isDeleted: true, deletedAt: new Date().toISOString() })
          );
        }
        await NativeModules.RoomPlanModule.saveRoomJson(
          'purge_manifest',
          JSON.stringify({ purgedAt: new Date().toISOString(), status: 'clean_factory_state' })
        );
      } catch (e) {
        console.warn('Failed recording purge manifest on disk:', e);
      }
    }
  },

  async getStorageStats(): Promise<{ roomCount: number; totalAreaSqFt: number; projectCount: number }> {
    await ensureLoaded();
    const activeRooms = inMemoryRooms.filter((r) => !r.is_sample);
    const totalArea = activeRooms.reduce((sum, r) => sum + (r.area_sqft || 0), 0);
    return {
      roomCount: activeRooms.length,
      totalAreaSqFt: Math.round(totalArea),
      projectCount: inMemoryProjects.length,
    };
  },

  async getFurniture(roomId: string): Promise<FurnitureItem[]> {
    return inMemoryFurniture.filter((f) => f.room_id === roomId);
  },

  async saveFurniture(item: FurnitureItem): Promise<void> {
    inMemoryFurniture.push(item);
  },

  async getHouseBuilds(): Promise<HouseBuild[]> {
    await ensureLoaded();
    return [...inMemoryBuilds];
  },

  async getHouseBuildById(id: string): Promise<HouseBuild | null> {
    await ensureLoaded();
    const build = inMemoryBuilds.find((b) => b.id === id);
    return build || null;
  },

  async saveHouseBuild(build: HouseBuild): Promise<void> {
    await ensureLoaded();
    const idx = inMemoryBuilds.findIndex((b) => b.id === build.id);
    if (idx >= 0) {
      inMemoryBuilds[idx] = build;
    } else {
      inMemoryBuilds.unshift(build);
    }
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('roomos_house_builds', JSON.stringify(inMemoryBuilds));
      } catch {}
    }
  },

  async deleteHouseBuild(id: string): Promise<void> {
    await ensureLoaded();
    inMemoryBuilds = inMemoryBuilds.filter((b) => b.id !== id);
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('roomos_house_builds', JSON.stringify(inMemoryBuilds));
      } catch {}
    }
  },

  async clearDatabase(): Promise<void> {
    await this.purgeAllData();
  },
};
