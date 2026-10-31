// sandbox/src/screens/SettingsScreen.tsx
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
import { Database } from '../db/database';

interface Props {
  onBack: () => void;
  onPurgeComplete: () => void;
}

export const SettingsScreen: React.FC<Props> = ({ onBack, onPurgeComplete }) => {
  const [stats, setStats] = useState({ roomCount: 0, totalAreaSqFt: 0, projectCount: 0 });
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    const data = await Database.getStorageStats();
    setStats(data);
    setLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handlePurgeAll = () => {
    Alert.alert(
      'Reset to Factory State',
      'This will permanently delete all scanned rooms, custom 3D wall edits, floorplans, and whole-house assemblies.\n\nThis action CANNOT be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purge Everything',
          style: 'destructive',
          onPress: async () => {
            await Database.purgeAllData();
            await loadStats();
            Alert.alert(
              'Reset Complete',
              'All data has been successfully purged. App is reset to factory state.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    onPurgeComplete();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f7" />
      <View style={styles.container}>
        {/* Navigation Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
            <Text style={styles.backBtnText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* App Info Card */}
          <View style={styles.card}>
            <View style={styles.appRow}>
              <View style={styles.appIconCircle}>
                <Text style={{ fontSize: 26 }}>🧊</Text>
              </View>
              <View style={styles.appTextGroup}>
                <Text style={styles.appName}>LiDAR Room Studio</Text>
                <Text style={styles.appSubtitle}>Apple HIG Precision • RoomPlan Engine</Text>
                <Text style={styles.appVersion}>Version 1.2.0 (Build 7788)</Text>
              </View>
            </View>
          </View>

          {/* Storage & Analytics Section */}
          <Text style={styles.sectionTitle}>STORAGE & DATA</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Scanned Rooms</Text>
              <Text style={styles.rowValue}>{loading ? '...' : `${stats.roomCount} rooms`}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Total Scanned Area</Text>
              <Text style={styles.rowValue}>
                {loading ? '...' : `${stats.totalAreaSqFt.toLocaleString()} sq ft`}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Local Database</Text>
              <Text style={styles.rowValue}>SQLite Local Storage</Text>
            </View>
          </View>

          {/* Data & Privacy / Factory Reset Section */}
          <Text style={styles.sectionTitle}>DANGER ZONE</Text>
          <View style={[styles.card, styles.dangerCard]}>
            <View style={styles.dangerHeader}>
              <Text style={styles.dangerTitle}>Purge All App Data</Text>
              <Text style={styles.dangerDescription}>
                Permanently deletes all captured LiDAR rooms, custom wall alignments, whole-house
                assemblies, and cached 3D STL files. Restores the application to its clean factory
                empty state.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.purgeBtn}
              onPress={handlePurgeAll}
              activeOpacity={0.8}
              accessibilityLabel="Purge All App Data"
            >
              <Text style={styles.purgeBtnText}>🗑️ Purge All App Data</Text>
            </TouchableOpacity>
          </View>

          {/* Privacy Note */}
          <Text style={styles.privacyFooter}>
            All spatial LiDAR point clouds and RoomPlan scans remain 100% on your device. Zero cloud
            sync, zero telemetry, zero analytics tracking.
          </Text>
        </ScrollView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e5ea',
    backgroundColor: '#ffffff',
  },
  backBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  backBtnText: {
    fontSize: 17,
    color: '#007aff',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8e8e93',
    letterSpacing: 0.8,
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 0.5,
    borderColor: '#e5e5ea',
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  appTextGroup: {
    flex: 1,
  },
  appName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1c1c1e',
  },
  appSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  appVersion: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    fontFamily: 'Courier',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  rowLabel: {
    fontSize: 15,
    color: '#1c1c1e',
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 15,
    color: '#8e8e93',
    fontWeight: '500',
  },
  divider: {
    height: 0.5,
    backgroundColor: '#f1f5f9',
    marginVertical: 8,
  },
  dangerCard: {
    borderColor: '#fecaca',
    backgroundColor: '#fffafb',
  },
  dangerHeader: {
    marginBottom: 14,
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 4,
  },
  dangerDescription: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  purgeBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purgeBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  privacyFooter: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 24,
    paddingHorizontal: 16,
  },
});
