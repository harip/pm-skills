// sandbox/src/types/room.ts

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface DimensionCallout {
  label: string;
  valueFt: number;
  formattedFt: string;
  formattedMetric: string;
}

export interface RoomMesh {
  widthFt: number;
  lengthFt: number;
  heightFt: number;
  areaSqFt: number;
  vertices: Point3D[];
  pointCount: number;
  doorways: { x: number; z: number; widthFt: number }[];
}

export interface Room {
  id: string;
  name: string;
  length_ft: number;
  width_ft: number;
  height_ft: number;
  area_sqft: number;
  mesh_json: string;
  floor_level?: string; // 'Basement' | 'Ground Floor' | 'Second Floor' | string
  elevation_ft?: number; // Elevation in feet relative to ground level
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

export interface FurnitureItem {
  id: string;
  room_id: string;
  name: string;
  category: 'seating' | 'table' | 'bed' | 'opening';
  pos_x: number;
  pos_z: number;
  rotation_deg: number;
  created_at: string;
}

export interface HouseProject {
  id: string;
  name: string;
  room_ids: string[];
  total_area_sqft: number;
  created_at: string;
  updated_at: string;
}
