// the wallpaper's settings, shown under "Wallpaper type" in Desktop and Wallpaper
import QtQuick
import QtQuick.Controls as QQC2
import org.kde.kirigami as Kirigami

Kirigami.FormLayout {
    id: root
    twinFormLayouts: parentLayout

    property var configDialog
    property var wallpaperConfiguration

    property string cfg_Travel
    property int cfg_Fps
    property alias cfg_PauseWhenCovered: pause.checked
    property alias formLayout: root

    QQC2.ComboBox {
        Kirigami.FormData.label: "Travel between places:"
        textRole: "text"
        valueRole: "value"
        model: [{ text: "Slow and scenic", value: "cinematic" }, { text: "Quick", value: "quick" }]
        currentIndex: Math.max(0, indexOfValue(root.cfg_Travel))
        onActivated: root.cfg_Travel = currentValue
    }
    QQC2.ComboBox {
        Kirigami.FormData.label: "Frames per second:"
        textRole: "text"
        valueRole: "value"
        model: [{ text: "15", value: 15 }, { text: "30", value: 30 }, { text: "60", value: 60 }]
        currentIndex: Math.max(0, indexOfValue(root.cfg_Fps))
        onActivated: root.cfg_Fps = currentValue
    }
    QQC2.CheckBox {
        id: pause
        Kirigami.FormData.label: "Save power:"
        text: "Pause while a maximized or full screen window covers it"
    }
}
