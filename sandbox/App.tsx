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
  const [activeTab, setActiveTab] = useState<Tab>('catalog');
  const [selectedRoom, setSelectedRoom] = useState<Room>(GeometryService.getSampleRooms()[0]);
  const [catalogRefreshKey, setCatalogRefreshKey] = useState(0);

  React.useEffect(() => {
    (async () => {
      const myRooms = await Database.getRooms();
      if (myRooms.length > 0) {
        setSelectedRoom(myRooms[0]);
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

  const handleBackToCatalog = () => {
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
          <RoomStudioScreen
            room={selectedRoom}
            onBack={handleBackToCatalog}
          />
        )}
        {activeTab === 'assembly' && (
          <HouseAssemblyScreen
            initialSelectedRoom={selectedRoom}
            onBack={handleBackToCatalog}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsScreen
            onBack={handleBackToCatalog}
            onPurgeComplete={() => {
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
            if (myRooms.length > 0 && (!selectedRoom || !myRooms.some((r) => r.id === selectedRoom.id))) {
              setSelectedRoom(myRooms[0]);
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
});
