import SwiftUI

// Mirrors packages/ui/tokens.json, theme "backend" (decision 0137). No values of our own.
enum Theme {
    static let textStrong = Color.black
    static let textModerate = Color.black.opacity(0.56)      // black-a56
    static let surfaceBase = Color.white
    static let surfaceSubtle = Color.black.opacity(0.04)     // black-a4
    static let surfaceHover = Color.black.opacity(0.04)
    static let divider = Color.black                         // border-divider-strong
    static let primaryDisabled = Color.black.opacity(0.08)   // black-a8
    static let alert = Color(red: 0xe0 / 255, green: 0x20 / 255, blue: 0x1b / 255)

    // Type styles (Inter; label = uppercase, 0.1em tracking)
    static func label(_ size: CGFloat) -> Font { .custom("Inter-Medium", size: size) }
    static func body(_ size: CGFloat) -> Font { .custom("Inter-Regular", size: size) }
}

extension View {
    /// label/* text style: Inter Medium, uppercase, 0.1em letter spacing
    func labelStyle(_ size: CGFloat, color: Color = Theme.textStrong) -> some View {
        self.font(Theme.label(size)).tracking(size * 0.1).textCase(.uppercase).foregroundColor(color)
    }
    func bodyStyle(_ size: CGFloat, color: Color = Theme.textStrong) -> some View {
        self.font(Theme.body(size)).foregroundColor(color)
    }
}

/// `button`: primary = black fill, white label; secondary = 1px black border.
struct ZButtonStyle: ButtonStyle {
    var primary = true
    @Environment(\.isEnabled) private var enabled
    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        return configuration.label
            .labelStyle(14, color: primary ? (enabled ? .white : Theme.textModerate) : (enabled ? Theme.textStrong : Theme.textModerate))
            .padding(.horizontal, 12).frame(height: 40)
            .background(primary
                        ? (enabled ? Color.black.opacity(pressed ? 0.64 : 1) : Theme.primaryDisabled)
                        : (enabled ? Color.clear : Theme.primaryDisabled))
            .overlay(Rectangle().stroke(primary || !enabled ? Color.clear : Theme.textStrong, lineWidth: 1))
            .contentShape(Rectangle())
    }
}

/// Small field label above a control (input `label`)
struct FieldLabel: View {
    let text: String
    var body: some View { Text(text).bodyStyle(14) }
}
