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
    @discardableResult
    func tap(
        _ trigger: XCUIElement,
        until destination: @autoclosure () -> XCUIElement,
        timeout: TimeInterval = 20,
        file: StaticString = #filePath,
        line: UInt = #line
    ) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            if destination().exists {
                return true
            }

            if trigger.waitUntilReady(timeout: max(0, min(2, deadline.timeIntervalSinceNow))) {
                trigger.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
            }

            if destination().waitForExistence(timeout: max(0, min(2, deadline.timeIntervalSinceNow))) {
                return true
            }
        } while Date() < deadline

        XCTFail(
            "Tapping \(trigger) did not reveal \(destination())",
            file: file,
            line: line
        )
        return false
    }

    @MainActor
    @discardableResult
    func completeOnboarding(reminders: Bool = false) -> Bool {
        guard exactElement(label: "Choose your look").waitForExistence(timeout: 45) else {
            XCTFail("Onboarding did not reach the appearance step.")
            return false
        }
        guard tap(buttons["Use light mode"], until: buttons["Begin"]) else { return false }
        guard tap(
            buttons["Begin"],
            until: exactElement(label: "Practice only—not a check-in.")
        ) else { return false }
        guard tap(
            buttons["Continue"],
            until: exactElement(label: "Small moments become patterns")
        ) else { return false }
        guard tap(
            buttons["Continue"],
            until: exactElement(label: "Private by default")
        ) else { return false }

        if reminders {
            guard tap(
                exactElement(label: "Set up reminders"),
                until: exactElement(label: "Morning, off")
            ) else { return false }
            guard tap(
                exactElement(label: "Morning, off"),
                until: exactElement(label: "Morning, on")
            ) else { return false }
            buttons["Done"].tapWhenReady()
            guard buttons["Allow reminders and start"].waitUntilReady(timeout: 20) else {
                XCTFail("Closing reminder setup did not reveal the enabled start action.")
                return false
            }
            guard tap(
                buttons["Allow reminders and start"],
                until: links["Check in before eating"],
                timeout: 30
            ) else { return false }
        } else {
            exactElement(label: "Not now").tapWhenReady()
            guard buttons["Start day 1"].waitUntilReady(timeout: 20) else {
                XCTFail("Choosing Not now did not enable Start day 1.")
                return false
            }
            guard tap(
                buttons["Start day 1"],
                until: links["Check in before eating"],
                timeout: 30
            ) else { return false }
        }

        return true
    }
}
