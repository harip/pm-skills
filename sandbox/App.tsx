// sandbox/App.tsx
import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, SafeAreaView, Platform, LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Room } from './src/types/room';
import { RoomsCatalogScreen } from './src/screens/RoomsCatalogScreen';
import { LidarScannerScreen } from './src/screens/LidarScannerScreen';
import { RoomStudioScreen } from './src/screens/RoomStudioScreen';
import { HouseAssemblyScreen } from './src/screens/HouseAssemblyScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { GeometryService } from './src/services/geometryService';
import { Database } from './src/db/database';

LogBox.ignoreLogs([
  'Unknown event handler property',
  '"shadow*" style props are deprecated',
  'props.pointerEvents is deprecated',
  'TouchableMixin is deprecated',
]);

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Unknown event handler property') ||
       args[0].includes('props.pointerEvents is deprecated') ||
       args[0].includes('"shadow*" style props are deprecated'))
    ) {
      return;
    }
    originalError(...args);
  };

  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('"shadow*" style props are deprecated') ||
       args[0].includes('props.pointerEvents is deprecated') ||
       args[0].includes('TouchableMixin is deprecated'))
    ) {
      return;
    }
    originalWarn(...args);
  };
}

type Tab = 'catalog' | 'scanner' | 'studio' | 'assembly' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('scanner');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [catalogRefreshKey, setCatalogRefreshKey] = useState(0);

  React.useEffect(() => {
    (async () => {
      const myRooms = await Database.getRooms();
      if (myRooms.length > 0) {
        setSelectedRoom(myRooms[0]);
      } else {
        setSelectedRoom(null);
      }
    })();
  }, []);

  const handleSelectRoom = (room: Room) => {
    setSelectedRoom(room);
    setActiveTab('studio');
  };

  const handleScanFinished = (newRoom: Room) => {
    setSelectedRoom(newRoom);
    setActiveTab('studio');
  };

  const handleBackToCatalog = async () => {
    const myRooms = await Database.getRooms();
    if (myRooms.length > 0) {
      if (!selectedRoom || !myRooms.some((r) => r.id === selectedRoom.id)) {
        setSelectedRoom(myRooms[0]);
      }
    } else {
      setSelectedRoom(null);
    }
    setCatalogRefreshKey((k) => k + 1);
    setActiveTab('catalog');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.screenContainer}>
        {activeTab === 'catalog' && (
          <RoomsCatalogScreen
            key={catalogRefreshKey}
            onNavigateToScan={() => setActiveTab('scanner')}
            onSelectRoom={handleSelectRoom}
            onNavigateToSettings={() => setActiveTab('settings')}
          />
        )}
        {activeTab === 'scanner' && (
          <LidarScannerScreen
            onBack={handleBackToCatalog}
            onScanFinished={handleScanFinished}
          />
        )}
        {activeTab === 'studio' && (
          selectedRoom ? (
            <RoomStudioScreen
              room={selectedRoom}
              onBack={handleBackToCatalog}
            />
          ) : (
            <SafeAreaView style={styles.emptyScreenContainer}>
              <View style={styles.emptyStateContainer}>
                <View style={styles.emptyIconCircle}>
                  <Text style={styles.emptyIconText}>🧊</Text>
                </View>
                <Text style={styles.emptyTitle}>No Rooms Scanned Yet</Text>
                <Text style={styles.emptyDescription}>
                  Capture your room with the LiDAR Scanner to view, edit, and inspect 3D models and blueprints in Studio.
                </Text>
                <TouchableOpacity
                  style={styles.emptyCtaBtn}
                  onPress={() => setActiveTab('scanner')}
                  activeOpacity={0.82}
                >
                  <Text style={styles.emptyCtaText}>Start Your First Scan</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          )
        )}
        {activeTab === 'assembly' && (
          <HouseAssemblyScreen
            onBack={handleBackToCatalog}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsScreen
            onBack={handleBackToCatalog}
            onPurgeComplete={() => {
              setSelectedRoom(null);
              setCatalogRefreshKey((k) => k + 1);
              setActiveTab('catalog');
            }}
          />
        )}
      </View>

      {/* Apple HIG Light Mode Bottom Tab Bar (4 Options) */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('catalog')}
        >
          <Text style={[styles.tabIcon, activeTab === 'catalog' && styles.tabIconActive]}>🏠</Text>
          <Text style={[styles.tabLabel, activeTab === 'catalog' && styles.tabLabelActive]}>
            Rooms
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('scanner')}
        >
          <Text style={[styles.tabIcon, activeTab === 'scanner' && styles.tabIconActive]}>⚡</Text>
          <Text style={[styles.tabLabel, activeTab === 'scanner' && styles.tabLabelActive]}>
            Scan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={async () => {
            const myRooms = await Database.getRooms();
            if (myRooms.length > 0) {
              if (!selectedRoom || !myRooms.some((r) => r.id === selectedRoom.id)) {
                setSelectedRoom(myRooms[0]);
              }
            } else {
              setSelectedRoom(null);
            }
            setActiveTab('studio');
          }}
        >
          <Text style={[styles.tabIcon, activeTab === 'studio' && styles.tabIconActive]}>🧊</Text>
          <Text style={[styles.tabLabel, activeTab === 'studio' && styles.tabLabelActive]}>
            Studio
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('assembly')}
        >
          <Text style={[styles.tabIcon, activeTab === 'assembly' && styles.tabIconActive]}>🏡</Text>
          <Text style={[styles.tabLabel, activeTab === 'assembly' && styles.tabLabelActive]}>
            Whole House
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={[styles.tabIcon, activeTab === 'settings' && styles.tabIconActive]}>⚙️</Text>
          <Text style={[styles.tabLabel, activeTab === 'settings' && styles.tabLabelActive]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    height: 64,
    backgroundColor: '#ffffff',
    borderTopWidth: 0.5,
    borderTopColor: '#e5e5ea',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 4,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.5,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8e8e93',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#007aff',
  },
  emptyScreenContainer: {
    flex: 1,
    backgroundColor: '#f5f5f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  emptyIconText: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1c1c1e',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  emptyCtaBtn: {
    backgroundColor: '#007aff',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 22,
    shadowColor: '#007aff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  emptyCtaText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
