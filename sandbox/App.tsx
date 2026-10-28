// sandbox/App.tsx
import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Room } from './src/types/room';
import { RoomsCatalogScreen } from './src/screens/RoomsCatalogScreen';
import { LidarScannerScreen } from './src/screens/LidarScannerScreen';
import { RoomStudioScreen } from './src/screens/RoomStudioScreen';
import { HouseAssemblyScreen } from './src/screens/HouseAssemblyScreen';
import { GeometryService } from './src/services/geometryService';
import { Database } from './src/db/database';

type Tab = 'catalog' | 'scanner' | 'studio' | 'stitch';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('studio');
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
        {activeTab === 'stitch' && (
          <HouseAssemblyScreen
            onBack={handleBackToCatalog}
          />
        )}
      </View>

      {/* Apple HIG Light Mode Bottom Tab Bar */}
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
          onPress={() => setActiveTab('studio')}
        >
          <Text style={[styles.tabIcon, activeTab === 'studio' && styles.tabIconActive]}>🧊</Text>
          <Text style={[styles.tabLabel, activeTab === 'studio' && styles.tabLabelActive]}>
            Studio
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('stitch')}
        >
          <Text style={[styles.tabIcon, activeTab === 'stitch' && styles.tabIconActive]}>🏡</Text>
          <Text style={[styles.tabLabel, activeTab === 'stitch' && styles.tabLabelActive]}>
            Whole House
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
