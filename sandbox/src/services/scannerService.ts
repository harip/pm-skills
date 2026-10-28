// sandbox/src/services/scannerService.ts
import { Room } from '../types/room';

export type ScanPhase = 'idle' | 'floor' | 'walls' | 'complete';

export type RoomCategory =
  | 'Living Room'
  | 'Primary Bedroom'
  | 'Kitchen & Dining'
  | 'Home Office'
  | 'Bathroom'
  | 'Custom Room';

export interface RoomPreset {
  category: RoomCategory;
  namePrefix: string;
  defaultLength: number;
  defaultWidth: number;
  defaultHeight: number;
  icon: string;
}

export const ROOM_PRESETS: RoomPreset[] = [
  {
    category: 'Living Room',
    namePrefix: 'Living Room',
    defaultLength: 18.5,
    defaultWidth: 15.2,
    defaultHeight: 9.0,
    icon: '🛋',
  },
  {
    category: 'Primary Bedroom',
    namePrefix: 'Primary Bedroom',
    defaultLength: 15.3,
    defaultWidth: 13.8,
    defaultHeight: 8.5,
    icon: '🛏',
  },
  {
    category: 'Kitchen & Dining',
    namePrefix: 'Kitchen & Dining',
    defaultLength: 14.2,
    defaultWidth: 11.5,
    defaultHeight: 9.0,
    icon: '🍳',
  },
  {
    category: 'Home Office',
    namePrefix: 'Home Office',
    defaultLength: 12.0,
    defaultWidth: 10.4,
    defaultHeight: 8.0,
    icon: '💻',
  },
  {
    category: 'Bathroom',
    namePrefix: 'Guest Bath',
    defaultLength: 9.2,
    defaultWidth: 6.8,
    defaultHeight: 8.0,
    icon: '🚿',
  },
  {
    category: 'Custom Room',
    namePrefix: 'Custom Room',
    defaultLength: 16.0,
    defaultWidth: 14.0,
    defaultHeight: 8.5,
    icon: '📐',
  },
];

export interface ScanSimulationState {
  isScanning: boolean;
  scanPhase: ScanPhase;
  selectedCategory: RoomCategory;
  roomName: string;
  pointCount: number;
  widthFt: number;
  lengthFt: number;
  heightFt: number;
  areaSqFt: number;
  points: { x: number; y: number; z: number; col: string }[];
}

export const ScannerService = {
  createInitialScan(category: RoomCategory = 'Living Room'): ScanSimulationState {
    const preset = ROOM_PRESETS.find((p) => p.category === category) || ROOM_PRESETS[0];
    return {
      isScanning: false,
      scanPhase: 'idle',
      selectedCategory: preset.category,
      roomName: `${preset.namePrefix} #${Math.floor(100 + Math.random() * 900)}`,
      pointCount: 0,
      widthFt: preset.defaultWidth,
      lengthFt: preset.defaultLength,
      heightFt: preset.defaultHeight,
      areaSqFt: +(preset.defaultWidth * preset.defaultLength).toFixed(1),
      points: [],
    };
  },

  // Switch preset
  applyPreset(state: ScanSimulationState, category: RoomCategory): ScanSimulationState {
    const preset = ROOM_PRESETS.find((p) => p.category === category) || ROOM_PRESETS[0];
    const newW = preset.defaultWidth;
    const newL = preset.defaultLength;
    const newH = preset.defaultHeight;
    return {
      ...state,
      selectedCategory: category,
      roomName: `${preset.namePrefix} #${Math.floor(100 + Math.random() * 900)}`,
      widthFt: newW,
      lengthFt: newL,
      heightFt: newH,
      areaSqFt: +(newW * newL).toFixed(1),
    };
  },

  // Generates incremental point batches as user sweeps the device
  generatePointBatch(
    currentPoints: { x: number; y: number; z: number; col: string }[],
    phase: ScanPhase,
    widthFt: number,
    lengthFt: number
  ): { x: number; y: number; z: number; col: string }[] {
    const next = [...currentPoints];
    const newCount = 8;
    const scaleX = widthFt * 5.5;
    const scaleZ = lengthFt * 5.5;

    for (let i = 0; i < newCount; i++) {
      if (next.length >= 220) break;
      let y = 60; // floor level default
      if (phase === 'walls' || phase === 'complete') {
        y = (Math.random() - 0.5) * 120; // wall height scatter
      }
      next.push({
        x: (Math.random() - 0.5) * scaleX,
        y,
        z: (Math.random() - 0.5) * scaleZ,
        col: Math.random() > 0.25 ? '#007aff' : '#34c759',
      });
    }
    return next;
  },

  finishScan(state: ScanSimulationState): Room {
    const id = 'room-' + Date.now();
    const finalWidth = state.widthFt > 0 ? state.widthFt : 14.5;
    const finalLength = state.lengthFt > 0 ? state.lengthFt : 16.0;
    const finalHeight = state.heightFt > 0 ? state.heightFt : 8.5;
    const finalArea = +(finalWidth * finalLength).toFixed(1);
    const finalPoints = state.pointCount > 0 ? state.pointCount : 12450;

    return {
      id,
      name: state.roomName,
      length_ft: finalLength,
      width_ft: finalWidth,
      height_ft: finalHeight,
      area_sqft: finalArea,
      mesh_json: JSON.stringify({
        category: state.selectedCategory,
        widthFt: finalWidth,
        lengthFt: finalLength,
        heightFt: finalHeight,
        pointCount: finalPoints,
        doorways: [{ x: 40, z: -60, widthFt: 3.0 }],
      }),
      is_sample: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  },
};
