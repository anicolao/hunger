import XCTest

enum BottomNavigationTab: Double {
    case today = 0.125
    case insights = 0.375
    case profile = 0.625
    case settings = 0.875
}

extension XCUIApplication {
    func tapBottomNavigation(_ tab: BottomNavigationTab) {
        coordinate(
            withNormalizedOffset: CGVector(dx: tab.rawValue, dy: 0.88)
        ).tap()
    }
}
