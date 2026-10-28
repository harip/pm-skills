// sandbox/ios/LiDARRoomStudio/RoomPlanModule.swift
import Foundation
import UIKit
import RoomPlan
import QuickLook

class QuickLookPreviewItem: NSObject, QLPreviewItem {
    var previewItemURL: URL?
    var previewItemTitle: String?
    init(url: URL, title: String) {
        self.previewItemURL = url
        self.previewItemTitle = title
    }
}

class QuickLookDataSource: NSObject, QLPreviewControllerDataSource {
    let item: QuickLookPreviewItem
    init(item: QuickLookPreviewItem) {
        self.item = item
    }
    func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
        return 1
    }
    func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
        return item
    }
}

@available(iOS 16.0, *)
@objc(RoomPlanModule)
class RoomPlanModule: NSObject {
    private var currentQuickLookDS: QuickLookDataSource?
    
    @objc
    static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    @objc
    func isSupported(_ resolve: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 16.0, *) {
            resolve(RoomCaptureSession.isSupported)
        } else {
            resolve(false)
        }
    }
    
    @objc
    func startRoomScan(_ resolve: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        guard #available(iOS 16.0, *), RoomCaptureSession.isSupported else {
            rejecter("NOT_SUPPORTED", "Apple RoomPlan LiDAR requires an iPhone with LiDAR running iOS 16+", nil)
            return
        }
        
        DispatchQueue.main.async {
            guard let rootVC = RCTPresentedViewController() ?? UIApplication.shared.windows.first(where: { $0.isKeyWindow })?.rootViewController else {
                rejecter("NO_VIEW_CONTROLLER", "Unable to find key root view controller", nil)
                return
            }
            
            let captureVC = RoomCaptureViewController()
            captureVC.modalPresentationStyle = .fullScreen
            captureVC.onComplete = { result in
                if let data = result {
                    resolve(data)
                } else {
                    rejecter("CANCELLED", "User cancelled the LiDAR room scan", nil)
                }
            }
            
            rootVC.present(captureVC, animated: true, completion: nil)
        }
    }
    
    @objc
    func openQuickLook(_ usdzPath: String, title: String, resolve: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async { [weak self] in
            guard let rootVC = RCTPresentedViewController() ?? UIApplication.shared.windows.first(where: { $0.isKeyWindow })?.rootViewController else {
                rejecter("NO_VIEW_CONTROLLER", "Unable to find key root view controller", nil)
                return
            }
            
            let fileURL = URL(fileURLWithPath: usdzPath)
            guard FileManager.default.fileExists(atPath: fileURL.path) else {
                rejecter("FILE_NOT_FOUND", "3D USDZ model not found at \(usdzPath)", nil)
                return
            }
            
            let previewItem = QuickLookPreviewItem(url: fileURL, title: title.isEmpty ? "Captured 3D Room" : title)
            let ds = QuickLookDataSource(item: previewItem)
            self?.currentQuickLookDS = ds
            
            let qlVC = QLPreviewController()
            qlVC.dataSource = ds
            qlVC.modalPresentationStyle = .fullScreen
            rootVC.present(qlVC, animated: true) {
                resolve(true)
            }
        }
    }
    
    @objc
    func getPersistedRooms(_ resolve: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        let docDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        guard let files = try? FileManager.default.contentsOfDirectory(at: docDir, includingPropertiesForKeys: nil) else {
            resolve([])
            return
        }
        
        var rooms: [[String: Any]] = []
        let jsonFiles = files.filter { $0.pathExtension == "json" && $0.lastPathComponent.hasPrefix("scanned_room_") }
        for jsonURL in jsonFiles.sorted(by: { $0.lastPathComponent > $1.lastPathComponent }) {
            if let data = try? Data(contentsOf: jsonURL),
               let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                rooms.append(obj)
            }
        }
        resolve(rooms)
    }
    
    @objc
    func saveRoomJson(_ filename: String, jsonString: String, resolve: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        let docDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let fileURL = docDir.appendingPathComponent(filename.hasSuffix(".json") ? filename : "\(filename).json")
        do {
            try jsonString.write(to: fileURL, atomically: true, encoding: .utf8)
            resolve(true)
        } catch {
            rejecter("SAVE_ERROR", error.localizedDescription, error)
        }
    }
    
    @objc
    func shareFile(_ filePath: String, resolve: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let rootVC = RCTPresentedViewController() ?? UIApplication.shared.windows.first(where: { $0.isKeyWindow })?.rootViewController else {
                rejecter("NO_VIEW_CONTROLLER", "Unable to find key root view controller", nil)
                return
            }
            let fileURL = URL(fileURLWithPath: filePath)
            guard FileManager.default.fileExists(atPath: fileURL.path) else {
                rejecter("FILE_NOT_FOUND", "File not found at \(filePath)", nil)
                return
            }
            let activityVC = UIActivityViewController(activityItems: [fileURL], applicationActivities: nil)
            if let popover = activityVC.popoverPresentationController {
                popover.sourceView = rootVC.view
                popover.sourceRect = CGRect(x: rootVC.view.bounds.midX, y: rootVC.view.bounds.midY, width: 0, height: 0)
                popover.permittedArrowDirections = []
            }
            rootVC.present(activityVC, animated: true) {
                resolve(true)
            }
        }
    }
    
    @objc
    func exportAndShareStl(_ filename: String, content: String, resolve: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        let docDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let safeName = filename.hasSuffix(".stl") ? filename : "\(filename).stl"
        let fileURL = docDir.appendingPathComponent(safeName)
        do {
            try content.write(to: fileURL, atomically: true, encoding: .utf8)
            DispatchQueue.main.async {
                guard let rootVC = RCTPresentedViewController() ?? UIApplication.shared.windows.first(where: { $0.isKeyWindow })?.rootViewController else {
                    resolve(fileURL.path)
                    return
                }
                let activityVC = UIActivityViewController(activityItems: [fileURL], applicationActivities: nil)
                if let popover = activityVC.popoverPresentationController {
                    popover.sourceView = rootVC.view
                    popover.sourceRect = CGRect(x: rootVC.view.bounds.midX, y: rootVC.view.bounds.midY, width: 0, height: 0)
                    popover.permittedArrowDirections = []
                }
                rootVC.present(activityVC, animated: true) {
                    resolve(fileURL.path)
                }
            }
        } catch {
            rejecter("WRITE_ERROR", error.localizedDescription, error)
        }
    }
}
