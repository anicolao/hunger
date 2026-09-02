import XCTest

enum BottomNavigationTab: String {
    case today = "Today"
    case insights = "Insights"
    case profile = "Profile"
    case settings = "Settings"
}

extension XCUIApplication {
    func tapBottomNavigation(_ tab: BottomNavigationTab) {
        let matches = links.matching(
            NSPredicate(format: "label == %@", tab.rawValue)
        )
        let deadline = Date().addingTimeInterval(20)
        repeat {
            if let link = matches.allElementsBoundByIndex.last(where: {
                $0.exists && $0.isHittable && $0.isEnabled
            }) {
                link.tap()
                return
            }
            RunLoop.current.run(until: Date().addingTimeInterval(0.1))
        } while Date() < deadline

        XCTFail("The visible \(tab.rawValue) tab was not ready to tap.")
    }
}
