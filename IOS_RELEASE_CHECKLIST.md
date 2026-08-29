# iOS Release Checklist

Use this checklist for every TestFlight or App Store candidate. Automated
items are release gates; unchecked manual items are intentionally not implied
by simulator success.

## Automated release gate

- [ ] From a clean checkout, run `nix run .#ios-verify` on macOS with the
  repository's supported Xcode.
- [ ] Confirm `ios/Hunger.xcodeproj` remains unchanged after generation.
- [ ] Confirm Swift unit tests and every phone-primary XCUITest pass.
- [ ] Confirm `.artifacts/ios/UITests.xcresult` contains the retained phone
  screenshots for persistence, reminders, export, and deletion/relaunch.
- [ ] Confirm the unsigned Release simulator app builds and
  `.artifacts/ios/release-asset-manifest.json` matches every bundled web file.
- [ ] Confirm the Release audit reports no source maps, fixture hooks, service
  worker, unmanifested files, actionable remote URLs, push/background modes,
  or networking entitlements.
- [ ] Confirm `PrivacyInfo.xcprivacy` is present in the built app and still
  declares no tracking or collected data.
- [ ] Confirm the parallel browser Verify job and retained PR preview are green.

## Physical-device matrix

- [ ] Install a signed clean build on the oldest supported iOS 17 device.
- [ ] Install a signed clean build on the current iOS device and current
  iPhone screen size.
- [ ] Upgrade an installed previous build in place; verify source events replay
  into the same state without re-onboarding.
- [ ] Complete onboarding, a before/after pair, insight review, an experiment,
  export, reminder pause, and Delete Everything in airplane mode.
- [ ] Force-quit and restart the device with an open check-in; verify event
  replay and the last allowlisted route recover without data loss.
- [ ] Deliver morning, midday, and evening local notifications at real times;
  verify neutral lock-screen copy, replacement without duplicates, and
  cancellation after pause and deletion.
- [ ] Exercise photo selection and camera capture, cancellation, denied access,
  a large image, and a memory-pressure return to the app. Verify photos remain
  local and are excluded from export by default.
- [ ] Fill device storage near capacity; verify failed photo/export writes are
  explained without losing the event sequence.
- [ ] Verify share-sheet presentation and cancellation on iPhone and the
  anchored popover on iPad.
- [ ] Verify large accessibility text, VoiceOver order/names, dark appearance,
  reduced motion, hardware keyboard navigation, rotation on iPad, and the
  smallest supported phone.
- [ ] Verify no request leaves the device during the primary journey using a
  device-side network capture, including cold launch and foreground recovery.

## Distribution and privacy

- [ ] Archive with the distribution identity and inspect the signed
  entitlements; there must be no APNs, background execution, associated
  domains, analytics, advertising, or unrestricted networking capability.
- [ ] Validate the archive and upload it to TestFlight without privacy-manifest
  or required-reason API warnings.
- [ ] Repeat the clean-install and upgrade smoke tests from the TestFlight build.
- [ ] Confirm App Store privacy answers say data is not collected and match the
  bundled privacy manifest and the app's offline behavior.
- [ ] Confirm screenshots, support URL, category, age rating, export-language
  disclosures, and medical/non-diagnostic wording match the reviewed product.
- [ ] Record tested device models, iOS versions, Xcode version, commit SHA,
  archive version/build, tester, and date in the release notes.
