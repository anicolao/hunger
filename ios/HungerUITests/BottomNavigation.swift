import XCTest

enum BottomNavigationTab: String {
    case today = "Today"
    case insights = "Insights"
    case profile = "Profile"
    case settings = "Settings"
}

extension XCUIApplication {
    func tapBottomNavigation(_ tab: BottomNavigationTab) {
        let visibleLink = links.matching(
            NSPredicate(format: "label == %@", tab.rawValue)
        ).allElementsBoundByIndex
            .filter { $0.exists && $0.frame.midY > frame.midY && $0.frame.maxY <= frame.maxY }
            .max { $0.frame.midY < $1.frame.midY }
        XCTAssertNotNil(visibleLink, "The visible \(tab.rawValue) tab must be accessible.")
        visibleLink?.coordinate(
            withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)
        ).tap()
    }
}
