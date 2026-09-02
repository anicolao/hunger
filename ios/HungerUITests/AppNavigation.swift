import XCTest

extension XCUIElement {
    @MainActor
    @discardableResult
    func waitUntilReady(timeout: TimeInterval = 10) -> Bool {
        let expectation = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == true AND hittable == true AND enabled == true"),
            object: self
        )
        return XCTWaiter.wait(for: [expectation], timeout: timeout) == .completed
    }

    @MainActor
    func tapWhenReady(
        timeout: TimeInterval = 10,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        guard waitUntilReady(timeout: timeout) else {
            XCTFail("Element was not ready to tap: \(self)", file: file, line: line)
            return
        }
        tap()
    }
}

extension XCUIApplication {
    @MainActor
    func exactElement(label: String) -> XCUIElement {
        descendants(matching: .any)
            .matching(NSPredicate(format: "label == %@", label))
            .firstMatch
    }

    @MainActor
    func scrollToAndTap(
        _ element: XCUIElement,
        timeout: TimeInterval = 20,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        guard element.waitForExistence(timeout: timeout) else {
            XCTFail("Element did not exist before scrolling: \(element)", file: file, line: line)
            return
        }

        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            let safeTop = frame.minY + 20
            let safeBottom = frame.maxY - 120
            if element.exists && element.isHittable && element.isEnabled
                && element.frame.minY >= safeTop && element.frame.maxY <= safeBottom {
                element.tap()
                return
            }
            if element.frame.minY < safeTop {
                coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.3)).press(
                    forDuration: 0.01,
                    thenDragTo: coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.6))
                )
            } else {
                coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.72)).press(
                    forDuration: 0.01,
                    thenDragTo: coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.42))
                )
            }
        } while Date() < deadline

        XCTFail("Element could not be scrolled into a tappable position: \(element)", file: file, line: line)
    }

    @MainActor
    func completeOnboarding(reminders: Bool = false) {
        XCTAssertTrue(exactElement(label: "Choose your look").waitForExistence(timeout: 45))
        buttons["Use light mode"].tapWhenReady()
        buttons["Begin"].tapWhenReady()
        XCTAssertTrue(
            exactElement(label: "Practice only—not a check-in.").waitForExistence(timeout: 10)
        )
        buttons["Continue"].tapWhenReady()
        XCTAssertTrue(
            exactElement(label: "Small moments become patterns").waitForExistence(timeout: 10)
        )
        buttons["Continue"].tapWhenReady()

        if reminders {
            exactElement(label: "Set up reminders").tapWhenReady()
            exactElement(label: "Morning, off").tapWhenReady()
            XCTAssertTrue(exactElement(label: "Morning, on").waitForExistence(timeout: 10))
            buttons["Done"].tapWhenReady()
            buttons["Allow reminders and start"].tapWhenReady(timeout: 20)
        } else {
            exactElement(label: "Not now").tapWhenReady()
            buttons["Start day 1"].tapWhenReady(timeout: 20)
        }

        XCTAssertTrue(
            links["Check in before eating"].waitForExistence(timeout: 20),
            "Onboarding must finish on the interactive Today screen."
        )
    }
}
