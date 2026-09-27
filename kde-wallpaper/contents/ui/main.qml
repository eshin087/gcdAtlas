import QtQuick
import QtWebEngine
import org.kde.plasma.plasmoid
import org.kde.kwindowsystem
import org.kde.plasma.core as PlasmaCore
import org.kde.plasma.wallpapers.image as PlasmaWallpaper

WallpaperItem {
    id: root

    readonly property string travel: (root.configuration && root.configuration.Travel === "quick") ? "quick" : "cinematic"
    readonly property int fps: (root.configuration && root.configuration.Fps) ? Math.max(10, Math.min(60, root.configuration.Fps)) : 30
    readonly property bool pauseEnabled: root.configuration ? root.configuration.PauseWhenCovered : true
    readonly property string titlePos: (root.configuration && root.configuration.TitlePos) ? root.configuration.TitlePos : "none"
    readonly property string textSize: (root.configuration && root.configuration.TextSize) ? root.configuration.TextSize : "normal"

    // True when a maximized or fullscreen window covers the wallpaper on this screen
    readonly property bool covered: (activeWindowMonitor.count > 0) && !KWindowSystem.showingDesktop
    readonly property bool paused: pauseEnabled && covered

    function wallpaperUrl() {
        var base = Qt.resolvedUrl("../gcdatlas.html") + "?wallpaper=1&travel=" + root.travel + "&fps=" + root.fps;
        if (root.titlePos && root.titlePos !== "none") {
            base += "&title=" + encodeURIComponent(root.titlePos);
        }
        if (root.textSize && root.textSize !== "normal") {
            base += "&textSize=" + encodeURIComponent(root.textSize);
        }
        return base;
    }

    contextualActions: [
        PlasmaCore.Action {
            text: i18nd("plasma_wallpaper_app.gcdatlas.wallpaper", "Next Object")
            icon.name: "go-next"
            onTriggered: web.runJavaScript("if (window.__cosmos && window.__cosmos.stepObject) window.__cosmos.stepObject(1);")
        },
        PlasmaCore.Action {
            text: i18nd("plasma_wallpaper_app.gcdatlas.wallpaper", "Next View")
            icon.name: "transform-rotate"
            onTriggered: web.runJavaScript("if (window.__cosmos && window.__cosmos.stepAngle) window.__cosmos.stepAngle(1);")
        }
    ]

    function applyFreeze() {
        web.runJavaScript("if (window.setFreeze) { window.setFreeze(" + (root.paused ? "true" : "false") + "); } else { window.__freeze = " + (root.paused ? "true" : "false") + "; }");
    }

    onPausedChanged: {
        if (!root.paused) {
            web.lifecycleState = WebEngineView.LifecycleState.Active;
        }
        root.applyFreeze();
    }

    PlasmaWallpaper.MaximizedWindowMonitor {
        id: activeWindowMonitor
        regionGeometry: root.parent && root.parent.screenGeometry ? root.parent.screenGeometry : Qt.rect(0, 0, Screen.width, Screen.height)
    }

    WebEngineView {
        id: web
        anchors.fill: parent
        audioMuted: true
        backgroundColor: "black"
        url: root.wallpaperUrl()
        visible: !root.paused
        onVisibleChanged: {
            if (!visible && root.paused) {
                lifecycleState = WebEngineView.LifecycleState.Frozen;
            }
        }
        settings.webGLEnabled: true
        settings.accelerated2dCanvasEnabled: true
        settings.playbackRequiresUserGesture: true
        settings.localContentCanAccessRemoteUrls: true
        settings.showScrollBars: false

        onLoadingChanged: function(loadRequest) {
            if (loadRequest.status === WebEngineView.LoadSucceededStatus) {
                root.applyFreeze();
                web.runJavaScript("if (window.setWallpaperTitlePos) { window.setWallpaperTitlePos('" + root.titlePos + "'); }");
                web.runJavaScript("if (window.setWallpaperTextSize) { window.setWallpaperTextSize('" + root.textSize + "'); }");
            }
        }
    }

    onTravelChanged: {
        web.url = root.wallpaperUrl();
    }
    onFpsChanged: {
        web.runJavaScript("if (window.setWallpaperFps) { window.setWallpaperFps(" + root.fps + "); } else { window.WALLPAPER_FPS = " + root.fps + "; }");
    }
    onTitlePosChanged: {
        web.runJavaScript("if (window.setWallpaperTitlePos) { window.setWallpaperTitlePos('" + root.titlePos + "'); }");
    }
    onTextSizeChanged: {
        web.runJavaScript("if (window.setWallpaperTextSize) { window.setWallpaperTextSize('" + root.textSize + "'); }");
    }

    Component.onCompleted: root.applyFreeze()
}
