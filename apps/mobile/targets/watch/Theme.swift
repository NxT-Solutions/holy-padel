import SwiftUI

/// The design's court palette — near-black ink surface, signal-orange accent,
/// white ink. Mirrors apps/mobile/src/theme/colors.ts and the Wear OS CourtColors.
/// The accent and Team B colours are the user's picks on the phone, mirrored
/// through the state payload's `palette` (orange / violet until the first push).
/// They're only written on the main queue, just before the state that carries
/// them is published, so every face re-renders with the new colours.
enum Court {
    static let ink = Color(red: 14.0 / 255.0, green: 17.0 / 255.0, blue: 22.0 / 255.0)
    nonisolated(unsafe) static var accent = Color(red: 255.0 / 255.0, green: 107.0 / 255.0, blue: 53.0 / 255.0)
    nonisolated(unsafe) static var teamB = Color(red: 139.0 / 255.0, green: 124.0 / 255.0, blue: 255.0 / 255.0)
    static let white = Color.white

    /// Adopts the phone's colours; a missing or malformed palette keeps the current ones.
    static func apply(_ palette: PaletteState?) {
        guard let palette,
              let accent = Color(hex: palette.accent),
              let teamB = Color(hex: palette.teamB)
        else { return }
        Court.accent = accent
        Court.teamB = teamB
    }
}

extension Color {
    /// `#RRGGBB` → an opaque colour, or nil when it isn't a 6-digit hex value.
    init?(hex: String) {
        let digits = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        guard digits.count == 6, let value = UInt32(digits, radix: 16) else { return nil }
        self.init(
            red: Double((value >> 16) & 0xFF) / 255.0,
            green: Double((value >> 8) & 0xFF) / 255.0,
            blue: Double(value & 0xFF) / 255.0
        )
    }
}
