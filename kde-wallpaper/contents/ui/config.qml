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
    property string cfg_TitlePos
    property string cfg_TextSize
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
    QQC2.ComboBox {
        Kirigami.FormData.label: "Object name:"
        textRole: "text"
        valueRole: "value"
        model: [
            { text: "Hide", value: "none" },
            { text: "Top left", value: "top-left" },
            { text: "Top center", value: "top-center" },
            { text: "Top right", value: "top-right" },
            { text: "Bottom left", value: "bottom-left" },
            { text: "Bottom center", value: "bottom-center" },
            { text: "Bottom right", value: "bottom-right" }
        ]
        currentIndex: Math.max(0, indexOfValue(root.cfg_TitlePos))
        onActivated: root.cfg_TitlePos = currentValue
    }
    QQC2.ComboBox {
        Kirigami.FormData.label: "Text size:"
        enabled: root.cfg_TitlePos !== "none"
        textRole: "text"
        valueRole: "value"
        model: [
            { text: "Extra small", value: "xsmall" },
            { text: "Small", value: "small" },
            { text: "Normal", value: "normal" },
            { text: "Large", value: "large" },
            { text: "Extra large", value: "xlarge" }
        ]
        currentIndex: Math.max(0, indexOfValue(root.cfg_TextSize))
        onActivated: root.cfg_TextSize = currentValue
    }
    QQC2.CheckBox {
        id: pause
        Kirigami.FormData.label: "Save power:"
        text: "Pause while a maximized or full screen window covers it"
    }
}
