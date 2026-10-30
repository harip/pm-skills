// sandbox/ios/LiDARRoomStudio/RoomCaptureViewController.swift
import UIKit
import RoomPlan
import ARKit

@available(iOS 16.0, *)
class RoomCaptureViewController: UIViewController, RoomCaptureViewDelegate, RoomCaptureSessionDelegate {
    var roomCaptureView: RoomCaptureView!
    var onComplete: (([String: Any]?) -> Void)?
    
    private var finalRoom: CapturedRoom?
    private var doneButton: UIButton!
    private var cancelButton: UIButton!
    private var statusPill: UILabel!

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setupRoomCaptureView()
        setupOverlayControls()
    }
    
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        startScanning()
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        stopScanning()
    }
    
    private func setupRoomCaptureView() {
        roomCaptureView = RoomCaptureView(frame: view.bounds)
        roomCaptureView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        roomCaptureView.delegate = self
        roomCaptureView.captureSession.delegate = self
        view.addSubview(roomCaptureView)
    }
    
    private func setupOverlayControls() {
        // Cancel button (top left)
        cancelButton = UIButton(type: .system)
        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.setTitleColor(.white, for: .normal)
        cancelButton.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .semibold)
        cancelButton.backgroundColor = UIColor(white: 0, alpha: 0.6)
        cancelButton.layer.cornerRadius = 18
        cancelButton.contentEdgeInsets = UIEdgeInsets(top: 8, left: 16, bottom: 8, right: 16)
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        cancelButton.addTarget(self, action: #selector(handleCancel), for: .touchUpInside)
        view.addSubview(cancelButton)
        
        // Status pill (top center)
        statusPill = UILabel()
        statusPill.text = "● LiDAR Active (RoomPlan)"
        statusPill.textColor = UIColor(red: 0.2, green: 0.85, blue: 0.35, alpha: 1.0)
        statusPill.font = UIFont.systemFont(ofSize: 13, weight: .bold)
        statusPill.backgroundColor = UIColor(white: 0, alpha: 0.65)
        statusPill.layer.cornerRadius = 14
        statusPill.clipsToBounds = true
        statusPill.textAlignment = .center
        statusPill.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(statusPill)
        
        // Done button (top right)
        doneButton = UIButton(type: .system)
        doneButton.setTitle("Done", for: .normal)
        doneButton.setTitleColor(.white, for: .normal)
        doneButton.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .bold)
        doneButton.backgroundColor = UIColor(red: 0.0, green: 0.48, blue: 1.0, alpha: 0.9)
        doneButton.layer.cornerRadius = 18
        doneButton.contentEdgeInsets = UIEdgeInsets(top: 8, left: 18, bottom: 8, right: 18)
        doneButton.translatesAutoresizingMaskIntoConstraints = false
        doneButton.addTarget(self, action: #selector(handleDone), for: .touchUpInside)
        view.addSubview(doneButton)
        
        NSLayoutConstraint.activate([
            cancelButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            cancelButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            cancelButton.heightAnchor.constraint(equalToConstant: 36),
            
            statusPill.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 14),
            statusPill.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            statusPill.heightAnchor.constraint(equalToConstant: 32),
            statusPill.widthAnchor.constraint(greaterThanOrEqualToConstant: 180),
            
            doneButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            doneButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            doneButton.heightAnchor.constraint(equalToConstant: 36),
        ])
    }
    
    private func startScanning() {
        let config = RoomCaptureSession.Configuration()
        roomCaptureView.captureSession.run(configuration: config)
    }
    
    private func stopScanning() {
        roomCaptureView.captureSession.stop()
    }
    
    @objc private func handleCancel() {
        stopScanning()
        dismiss(animated: true) { [weak self] in
            self?.onComplete?(nil)
        }
    }
    
    @objc private func handleDone() {
        doneButton.isEnabled = false
        statusPill.text = "Building Watertight 3D Mesh..."
        statusPill.textColor = .yellow
        stopScanning()
    }
    
    // MARK: - RoomCaptureViewDelegate
    func captureView(shouldPresent roomDataForProcessing: CapturedRoomData, error: (Error)?) -> Bool {
        return true
    }
    
    func captureView(didPresent processedResult: CapturedRoom, error: (Error)?) {
        self.finalRoom = processedResult
        self.processAndFinish(room: processedResult)
    }
    
    private func processAndFinish(room: CapturedRoom) {
        var minX: Float = .greatestFiniteMagnitude
        var maxX: Float = -.greatestFiniteMagnitude
        var minZ: Float = .greatestFiniteMagnitude
        var maxZ: Float = -.greatestFiniteMagnitude
        var avgHeight: Float = 2.6
        var heights: [Float] = []
        var elevationsY: [Float] = []
        
        var wallsData: [[String: Any]] = []
        for (idx, wall) in room.walls.enumerated() {
            let pos = wall.transform.columns.3
            let dim = wall.dimensions
            let dir = wall.transform.columns.0
            heights.append(dim.y)
            elevationsY.append(pos.y)
            
            let halfL = dim.x / 2.0
            let startX = pos.x - dir.x * halfL
            let startZ = pos.z - dir.z * halfL
            let endX = pos.x + dir.x * halfL
            let endZ = pos.z + dir.z * halfL
            
            minX = min(minX, min(startX, endX))
            maxX = max(maxX, max(startX, endX))
            minZ = min(minZ, min(startZ, endZ))
            maxZ = max(maxZ, max(startZ, endZ))
            
            let yaw = atan2(wall.transform.columns.0.z, wall.transform.columns.0.x)
            wallsData.append([
                "id": "wall-\(idx)",
                "x": Double(round(pos.x * 3.28084 * 100) / 100),
                "y": Double(round(pos.y * 3.28084 * 100) / 100),
                "z": Double(round(pos.z * 3.28084 * 100) / 100),
                "x1": Double(round(startX * 3.28084 * 100) / 100),
                "z1": Double(round(startZ * 3.28084 * 100) / 100),
                "x2": Double(round(endX * 3.28084 * 100) / 100),
                "z2": Double(round(endZ * 3.28084 * 100) / 100),
                "lengthFt": Double(round(dim.x * 3.28084 * 10) / 10),
                "heightFt": Double(round(dim.y * 3.28084 * 10) / 10),
                "thicknessFt": Double(round(dim.z * 3.28084 * 100) / 100),
                "yawDeg": Double(round(yaw * 180.0 / .pi)),
            ])
        }
        
        if !heights.isEmpty {
            avgHeight = heights.reduce(0, +) / Float(heights.count)
        }
        
        let avgElevation = elevationsY.isEmpty ? Float(0.0) : (elevationsY.reduce(0, +) / Float(elevationsY.count))
        let elevationFt = Double(round(Double(avgElevation * 3.28084) * 10) / 10)
        
        // Multi-Story / Altitude Floor Level Classifier
        let floorLevel: String
        if avgElevation < -1.2 {
            floorLevel = "Basement"
        } else if avgElevation > 1.8 {
            floorLevel = "Second Floor"
        } else {
            floorLevel = "Ground Floor"
        }
        
        var widthMeters: Float = (maxX > minX) ? (maxX - minX) : 4.2
        var lengthMeters: Float = (maxZ > minZ) ? (maxZ - minZ) : 4.8
        if widthMeters < 1.5 { widthMeters = 3.8 }
        if lengthMeters < 1.5 { lengthMeters = 4.5 }
        if avgHeight < 2.0 { avgHeight = 2.6 }
        
        let widthFt = Double(round(Double(widthMeters * 3.28084) * 10) / 10)
        let lengthFt = Double(round(Double(lengthMeters * 3.28084) * 10) / 10)
        let heightFt = Double(round(Double(avgHeight * 3.28084) * 10) / 10)
        let areaSqFt = Double(round(widthFt * lengthFt * 10) / 10)
        
        var doorsData: [[String: Any]] = []
        for (idx, door) in room.doors.enumerated() {
            let pos = door.transform.columns.3
            let dir = door.transform.columns.0
            let halfL = door.dimensions.x / 2.0
            doorsData.append([
                "id": "door-\(idx)",
                "x": Double(round(pos.x * 3.28084 * 100) / 100),
                "y": Double(round(pos.y * 3.28084 * 100) / 100),
                "z": Double(round(pos.z * 3.28084 * 100) / 100),
                "x1": Double(round((pos.x - dir.x * halfL) * 3.28084 * 100) / 100),
                "z1": Double(round((pos.z - dir.z * halfL) * 3.28084 * 100) / 100),
                "x2": Double(round((pos.x + dir.x * halfL) * 3.28084 * 100) / 100),
                "z2": Double(round((pos.z + dir.z * halfL) * 3.28084 * 100) / 100),
                "widthFt": Double(round(door.dimensions.x * 3.28084 * 10) / 10),
                "heightFt": Double(round(door.dimensions.y * 3.28084 * 10) / 10),
            ])
        }
        
        var closetsData: [[String: Any]] = []
        var windowsData: [[String: Any]] = []
        for (idx, win) in room.windows.enumerated() {
            let pos = win.transform.columns.3
            let dir = win.transform.columns.0
            let halfL = win.dimensions.x / 2.0
            let dimY = win.dimensions.y
            let sillM = pos.y - (dimY / 2.0)
            let sillFt = Double(round(Double(sillM * 3.28084) * 100) / 100)
            let heightFt = Double(round(Double(dimY * 3.28084) * 10) / 10)
            let widthFt = Double(round(Double(win.dimensions.x * 3.28084) * 10) / 10)

            // Solution A: Geometric Disambiguation
            // A closed closet (or floor-level door panel) starts at floor level (< 16" / 0.40m)
            // and reaches full door height (> 6'5" / 1.95m). It is NOT an exterior window opening.
            if sillFt < 1.33 && heightFt > 6.4 {
                closetsData.append([
                    "id": "closet-\(idx)",
                    "x": Double(round(pos.x * 3.28084 * 100) / 100),
                    "y": Double(round(pos.y * 3.28084 * 100) / 100),
                    "z": Double(round(pos.z * 3.28084 * 100) / 100),
                    "x1": Double(round((pos.x - dir.x * halfL) * 3.28084 * 100) / 100),
                    "z1": Double(round((pos.z - dir.z * halfL) * 3.28084 * 100) / 100),
                    "x2": Double(round((pos.x + dir.x * halfL) * 3.28084 * 100) / 100),
                    "z2": Double(round((pos.z + dir.z * halfL) * 3.28084 * 100) / 100),
                    "widthFt": widthFt,
                    "heightFt": heightFt,
                    "sillFt": sillFt,
                ])
            } else {
                windowsData.append([
                    "id": "win-\(idx)",
                    "x": Double(round(pos.x * 3.28084 * 100) / 100),
                    "y": Double(round(pos.y * 3.28084 * 100) / 100),
                    "z": Double(round(pos.z * 3.28084 * 100) / 100),
                    "x1": Double(round((pos.x - dir.x * halfL) * 3.28084 * 100) / 100),
                    "z1": Double(round((pos.z - dir.z * halfL) * 3.28084 * 100) / 100),
                    "x2": Double(round((pos.x + dir.x * halfL) * 3.28084 * 100) / 100),
                    "z2": Double(round((pos.z + dir.z * halfL) * 3.28084 * 100) / 100),
                    "widthFt": widthFt,
                    "heightFt": heightFt,
                    "sillFt": sillFt,
                ])
            }
        }
        
        var objectsData: [[String: Any]] = []
        for (idx, obj) in room.objects.enumerated() {
            let pos = obj.transform.columns.3
            let dirX = obj.transform.columns.0
            let dirY = obj.transform.columns.1
            let dirZ = obj.transform.columns.2
            let yaw = atan2(dirX.z, dirX.x)
            objectsData.append([
                "id": "obj-\(idx)",
                "category": "\(obj.category)",
                "x": Double(round(pos.x * 3.28084 * 100) / 100),
                "y": Double(round(pos.y * 3.28084 * 100) / 100),
                "z": Double(round(pos.z * 3.28084 * 100) / 100),
                "widthFt": Double(round(obj.dimensions.x * 3.28084 * 100) / 100),
                "heightFt": Double(round(obj.dimensions.y * 3.28084 * 100) / 100),
                "lengthFt": Double(round(obj.dimensions.z * 3.28084 * 100) / 100),
                "yawDeg": Double(round(yaw * 180.0 / .pi * 10) / 10),
                "dirXx": Double(round(dirX.x * 10000) / 10000),
                "dirXy": Double(round(dirX.y * 10000) / 10000),
                "dirXz": Double(round(dirX.z * 10000) / 10000),
                "dirZx": Double(round(dirZ.x * 10000) / 10000),
                "dirZy": Double(round(dirZ.y * 10000) / 10000),
                "dirZz": Double(round(dirZ.z * 10000) / 10000),
            ])
        }
        
        // Export persistent USDZ 3D model in Documents directory
        let timestamp = Int(Date().timeIntervalSince1970)
        let docDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let usdzURL = docDir.appendingPathComponent("scanned_room_\(timestamp).usdz")
        try? room.export(to: usdzURL)
        
        // Also export native watertight 3D STL file directly from CapturedRoom surfaces & objects
        let stlURL = docDir.appendingPathComponent("scanned_room_\(timestamp).stl")
        self.exportSTL(room: room, to: stlURL)
        
        let roomLabel = floorLevel == "Ground Floor"
            ? "Physical Room (\(Int(round(lengthFt)))' × \(Int(round(widthFt)))')"
            : "\(floorLevel) (\(Int(round(lengthFt)))' × \(Int(round(widthFt)))')"
        
        let result: [String: Any] = [
            "isRealLiDAR": true,
            "floorLevel": floorLevel,
            "elevationFt": elevationFt,
            "elevationMeters": Double(avgElevation),
            "widthFt": widthFt,
            "lengthFt": lengthFt,
            "heightFt": heightFt,
            "areaSqFt": areaSqFt,
            "wallCount": room.walls.count,
            "doorCount": room.doors.count,
            "windowCount": windowsData.count,
            "closetCount": closetsData.count,
            "objectCount": room.objects.count,
            "walls": wallsData,
            "doors": doorsData,
            "windows": windowsData,
            "closets": closetsData,
            "objects": objectsData,
            "usdzPath": usdzURL.path,
            "stlPath": stlURL.path,
            "roomName": roomLabel,
        ]
        
        // Persist room JSON to disk for permanent storage
        let jsonURL = docDir.appendingPathComponent("scanned_room_\(timestamp).json")
        if let jsonData = try? JSONSerialization.data(withJSONObject: result, options: .prettyPrinted) {
            try? jsonData.write(to: jsonURL)
        }
        
        DispatchQueue.main.async { [weak self] in
            self?.dismiss(animated: true) {
                self?.onComplete?(result)
            }
        }
    }
    
    // Generates an ASCII STL file in standard 3D printer Z-up coordinate space
    // Anchors all walls and furniture objects directly to build plate Z=0 (Certified No Empty Initial Layer)
    private func exportSTL(room: CapturedRoom, to url: URL) {
        var stl = "solid RoomPlan_LiDAR_Room\n"
        
        // Find minimum floor elevation across all walls
        let minY: Float = room.walls.map { $0.transform.columns.3.y - $0.dimensions.y / 2.0 }.min() ?? 0.0
        
        // Helper to append a triangle facet in standard 3D printing Z-up (X=x, Y=z, Z=y-minY)
        func addFacet(_ a: SIMD4<Float>, _ b: SIMD4<Float>, _ c: SIMD4<Float>) {
            // Map ARKit (X, Y, Z) to 3D print standard (X, Z, Y-minY)
            let pA = SIMD3<Float>(a.x, a.z, a.y - minY)
            let pB = SIMD3<Float>(c.x, c.z, c.y - minY) // Reverse order (a, c, b) for outward normal
            let pC = SIMD3<Float>(b.x, b.z, b.y - minY)
            
            let v1 = pB - pA
            let v2 = pC - pA
            let norm = simd_normalize(simd_cross(v1, v2))
            stl += "  facet normal \(norm.x) \(norm.y) \(norm.z)\n"
            stl += "    outer loop\n"
            stl += "      vertex \(pA.x) \(pA.y) \(pA.z)\n"
            stl += "      vertex \(pB.x) \(pB.y) \(pB.z)\n"
            stl += "      vertex \(pC.x) \(pC.y) \(pC.z)\n"
            stl += "    endloop\n  endfacet\n"
        }
        
        for wall in room.walls {
            let pos = wall.transform.columns.3
            let dim = wall.dimensions
            let dx = wall.transform.columns.0 * (dim.x / 2.0)
            let dy = wall.transform.columns.1 * (dim.y / 2.0)
            let dz = wall.transform.columns.2 * (dim.z / 2.0)
            
            // 8 corners of the solid wall prism in meters
            let c0 = pos - dx - dy - dz
            let c1 = pos + dx - dy - dz
            let c2 = pos + dx + dy - dz
            let c3 = pos - dx + dy - dz
            let c4 = pos - dx - dy + dz
            let c5 = pos + dx - dy + dz
            let c6 = pos + dx + dy + dz
            let c7 = pos - dx + dy + dz
            
            // 6 faces (12 triangles) for each wall box
            addFacet(c0, c2, c1); addFacet(c0, c3, c2) // Back face
            addFacet(c4, c5, c6); addFacet(c4, c6, c7) // Front face
            addFacet(c0, c1, c5); addFacet(c0, c5, c4) // Bottom face
            addFacet(c3, c7, c6); addFacet(c3, c6, c2) // Top face
            addFacet(c0, c4, c7); addFacet(c0, c7, c3) // Left face
            addFacet(c1, c2, c6); addFacet(c1, c6, c5) // Right face
        }
        
        for obj in room.objects {
            let pos = obj.transform.columns.3
            let dim = obj.dimensions
            let dx = obj.transform.columns.0 * (dim.x / 2.0)
            let dy = obj.transform.columns.1 * (dim.y / 2.0)
            let dz = obj.transform.columns.2 * (dim.z / 2.0)
            
            // Solid Grounded Support Base:
            // Extend bottom face to minY (Z=0.0 in STL) so Layer 0 is never empty
            var c0 = pos - dx - dy - dz; c0.y = minY
            var c1 = pos + dx - dy - dz; c1.y = minY
            let c2 = pos + dx + dy - dz
            let c3 = pos - dx + dy - dz
            var c4 = pos - dx - dy + dz; c4.y = minY
            var c5 = pos + dx - dy + dz; c5.y = minY
            let c6 = pos + dx + dy + dz
            let c7 = pos - dx + dy + dz
            
            addFacet(c0, c2, c1); addFacet(c0, c3, c2)
            addFacet(c4, c5, c6); addFacet(c4, c6, c7)
            addFacet(c0, c1, c5); addFacet(c0, c5, c4)
            addFacet(c3, c7, c6); addFacet(c3, c6, c2)
            addFacet(c0, c4, c7); addFacet(c0, c7, c3)
            addFacet(c1, c2, c6); addFacet(c1, c6, c5)
        }
        
        stl += "endsolid RoomPlan_LiDAR_Room\n"
        try? stl.write(to: url, atomically: true, encoding: .utf8)
    }
}
