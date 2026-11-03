// sandbox/ios/LiDARRoomStudio/ObjectCaptureViewController.swift
import Foundation
import UIKit
import SwiftUI
import RealityKit

@available(iOS 17.0, *)
@MainActor
public class ObjectCaptureViewController: UIViewController {
    public var objectId: String = ""
    public var objectCategory: String = ""
    public var onComplete: (([String: Any]?) -> Void)?

    private let session = ObjectCaptureSession()
    private var imagesFolder: URL?
    private var isReconstructing = false
    private let progressLabel = UILabel()
    private let spinner = UIActivityIndicatorView(style: .large)
    private let overlayView = UIView()

    public override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent("ObjectCapture_\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        self.imagesFolder = tempDir

        let captureView = ObjectCaptureView(session: session)
        let hosting = UIHostingController(rootView: captureView)
        addChild(hosting)
        hosting.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(hosting.view)
        NSLayoutConstraint.activate([
            hosting.view.topAnchor.constraint(equalTo: view.topAnchor),
            hosting.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            hosting.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            hosting.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        hosting.didMove(toParent: self)

        setupTopBar()
        setupOverlay()
        observeSession()

        session.start(imagesDirectory: tempDir)
    }

    private func setupTopBar() {
        let topBar = UIView()
        topBar.backgroundColor = UIColor.black.withAlphaComponent(0.6)
        topBar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(topBar)

        let cancelBtn = UIButton(type: .system)
        cancelBtn.setTitle("Cancel", for: .normal)
        cancelBtn.setTitleColor(.white, for: .normal)
        cancelBtn.titleLabel?.font = .systemFont(ofSize: 17, weight: .regular)
        cancelBtn.addTarget(self, action: #selector(handleCancel), for: .touchUpInside)
        cancelBtn.translatesAutoresizingMaskIntoConstraints = false
        topBar.addSubview(cancelBtn)

        let titleLabel = UILabel()
        titleLabel.text = objectCategory.isEmpty ? "Capture 3D Object" : "Scan \(objectCategory.capitalized)"
        titleLabel.textColor = .white
        titleLabel.font = .systemFont(ofSize: 17, weight: .semibold)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        topBar.addSubview(titleLabel)

        let finishBtn = UIButton(type: .system)
        finishBtn.setTitle("Finish", for: .normal)
        finishBtn.setTitleColor(.systemBlue, for: .normal)
        finishBtn.titleLabel?.font = .systemFont(ofSize: 17, weight: .bold)
        finishBtn.addTarget(self, action: #selector(handleFinish), for: .touchUpInside)
        finishBtn.translatesAutoresizingMaskIntoConstraints = false
        topBar.addSubview(finishBtn)

        NSLayoutConstraint.activate([
            topBar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            topBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            topBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            topBar.heightAnchor.constraint(equalToConstant: 50),

            cancelBtn.leadingAnchor.constraint(equalTo: topBar.leadingAnchor, constant: 16),
            cancelBtn.centerYAnchor.constraint(equalTo: topBar.centerYAnchor),

            titleLabel.centerXAnchor.constraint(equalTo: topBar.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: topBar.centerYAnchor),

            finishBtn.trailingAnchor.constraint(equalTo: topBar.trailingAnchor, constant: -16),
            finishBtn.centerYAnchor.constraint(equalTo: topBar.centerYAnchor),
        ])
    }

    @objc private func handleCancel() {
        session.cancel()
        cleanUpImages()
        dismiss(animated: true) {
            self.onComplete?(nil)
        }
    }

    @objc private func handleFinish() {
        session.finish()
    }

    private func setupOverlay() {
        overlayView.backgroundColor = UIColor.black.withAlphaComponent(0.85)
        overlayView.translatesAutoresizingMaskIntoConstraints = false
        overlayView.isHidden = true
        view.addSubview(overlayView)

        spinner.color = .white
        spinner.translatesAutoresizingMaskIntoConstraints = false
        overlayView.addSubview(spinner)

        progressLabel.textColor = .white
        progressLabel.font = .systemFont(ofSize: 17, weight: .semibold)
        progressLabel.textAlignment = .center
        progressLabel.numberOfLines = 0
        progressLabel.text = "Reconstructing 3D Model on Device..."
        progressLabel.translatesAutoresizingMaskIntoConstraints = false
        overlayView.addSubview(progressLabel)

        NSLayoutConstraint.activate([
            overlayView.topAnchor.constraint(equalTo: view.topAnchor),
            overlayView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            overlayView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            overlayView.trailingAnchor.constraint(equalTo: view.trailingAnchor),

            spinner.centerXAnchor.constraint(equalTo: overlayView.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: overlayView.centerYAnchor, constant: -30),

            progressLabel.topAnchor.constraint(equalTo: spinner.bottomAnchor, constant: 20),
            progressLabel.leadingAnchor.constraint(equalTo: overlayView.leadingAnchor, constant: 30),
            progressLabel.trailingAnchor.constraint(equalTo: overlayView.trailingAnchor, constant: -30),
        ])
    }

    private func observeSession() {
        Task { [weak self] in
            guard let self = self else { return }
            for await state in self.session.stateUpdates {
                switch state {
                case .completed:
                    self.startPhotogrammetryReconstruction()
                case .failed(let error):
                    self.handleError(error)
                default:
                    break
                }
            }
        }
    }

    private func startPhotogrammetryReconstruction() {
        guard !isReconstructing, let imagesFolder = imagesFolder else { return }
        isReconstructing = true

        overlayView.isHidden = false
        spinner.startAnimating()
        progressLabel.text = "Reconstructing 3D Mesh on Device (Neural Engine)...\n0%"

        let timestamp = Int(Date().timeIntervalSince1970)
        let docDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let outputURL = docDir.appendingPathComponent("captured_furniture_\(objectId)_\(timestamp).usdz")

        Task.detached(priority: .userInitiated) { [weak self] in
            guard let self = self else { return }
            do {
                let photoSession = try PhotogrammetrySession(input: imagesFolder)
                try photoSession.process(requests: [
                    .modelFile(url: outputURL, detail: .reduced)
                ])

                for try await output in photoSession.outputs {
                    switch output {
                    case .requestProgress(_, fractionComplete: let fraction):
                        await MainActor.run {
                            self.progressLabel.text = "Reconstructing 3D Mesh on Device (Neural Engine)...\n\(Int(fraction * 100))%"
                        }
                    case .processingComplete:
                        await MainActor.run {
                            self.cleanUpImages()
                            self.dismiss(animated: true) {
                                self.onComplete?([
                                    "success": true,
                                    "objectId": self.objectId,
                                    "category": self.objectCategory,
                                    "usdzPath": outputURL.path,
                                    "filename": outputURL.lastPathComponent,
                                    "timestamp": timestamp
                                ])
                            }
                        }
                        return
                    case .requestError(_, let error):
                        await MainActor.run {
                            self.handleError(error)
                        }
                        return
                    default:
                        break
                    }
                }
            } catch {
                await MainActor.run {
                    self.handleError(error)
                }
            }
        }
    }

    private func cleanUpImages() {
        if let folder = imagesFolder {
            try? FileManager.default.removeItem(at: folder)
        }
    }

    private func handleError(_ error: Error) {
        overlayView.isHidden = true
        spinner.stopAnimating()
        cleanUpImages()

        let alert = UIAlertController(
            title: "Object Capture Incomplete",
            message: error.localizedDescription,
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "OK", style: .default) { [weak self] _ in
            self?.dismiss(animated: true) {
                self?.onComplete?(nil)
            }
        })
        present(alert, animated: true)
    }
}
