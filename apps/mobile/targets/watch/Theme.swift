import SwiftUI

/// The design's court palette — near-black ink surface, lime accent, white ink.
/// Mirrors apps/mobile/src/theme/colors.ts and the Wear OS CourtColors.
enum Court {
    static let ink = Color(red: 14.0 / 255.0, green: 17.0 / 255.0, blue: 22.0 / 255.0)
    static let lime = Color(red: 198.0 / 255.0, green: 241.0 / 255.0, blue: 53.0 / 255.0)
    static let white = Color.white
}
